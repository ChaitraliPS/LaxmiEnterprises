import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:open_filex/open_filex.dart';
import '../config/app_config.dart';
import 'offline_screen.dart';

class WebViewScreen extends StatefulWidget {
  final String initialUrl;

  const WebViewScreen({super.key, this.initialUrl = AppConfig.initialUrl});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> with WidgetsBindingObserver {
  late final WebViewController _controller;
  bool _isControllerInitialized = false;
  int _loadingProgress = 0;
  bool _hasFatalError = false;

  // Comprehensive JavaScript injection to intercept PDF and file downloads across all libraries (jsPDF, FileSaver, Blob URLs)
  static const String _downloadBridgeJs = r'''
  (function() {
    if (window.__le_download_bridge_installed) return;
    window.__le_download_bridge_installed = true;

    function deliver(filename, dataUrl) {
      try {
        if (window.FlutterDownloadBridge) {
          window.FlutterDownloadBridge.postMessage(JSON.stringify({
            filename: filename || 'document.pdf',
            dataUrl: dataUrl
          }));
        }
      } catch (err) {
        console.error('FlutterDownloadBridge post error:', err);
      }
    }

    function process(filename, blobOrUrl) {
      if (!blobOrUrl) return;
      try {
        if (blobOrUrl instanceof Blob) {
          const reader = new FileReader();
          reader.onloadend = function() {
            deliver(filename, reader.result);
          };
          reader.readAsDataURL(blobOrUrl);
        } else if (typeof blobOrUrl === 'string') {
          if (blobOrUrl.startsWith('data:')) {
            deliver(filename, blobOrUrl);
          } else if (blobOrUrl.startsWith('blob:')) {
            fetch(blobOrUrl)
              .then(res => res.blob())
              .then(blob => {
                const reader = new FileReader();
                reader.onloadend = function() {
                  deliver(filename, reader.result);
                };
                reader.readAsDataURL(blob);
              })
              .catch(err => console.error('Blob fetch error:', err));
          }
        }
      } catch (e) {
        console.error('Process error:', e);
      }
    }

    // 1. Intercept window.saveAs (jsPDF checks globalObject.saveAs before creating <a> tag!)
    window.saveAs = function(blob, filename) {
      console.log('Intercepted window.saveAs for:', filename);
      process(filename, blob);
    };

    // 2. Intercept HTMLAnchorElement.prototype.dispatchEvent (for detached <a> tags in file downloaders)
    const origDispatch = HTMLAnchorElement.prototype.dispatchEvent;
    HTMLAnchorElement.prototype.dispatchEvent = function(evt) {
      try {
        if (evt && (evt.type === 'click' || evt.type === 'MouseEvents')) {
          const downloadAttr = this.getAttribute('download') || this.download;
          const href = this.href;
          if (downloadAttr && href && (href.startsWith('blob:') || href.startsWith('data:'))) {
            process(downloadAttr, href);
            return true;
          }
        }
      } catch(e) {
        console.error(e);
      }
      return origDispatch.apply(this, arguments);
    };

    // 3. Intercept HTMLAnchorElement.prototype.click
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      try {
        const downloadAttr = this.getAttribute('download') || this.download;
        const href = this.href;
        if (downloadAttr && href && (href.startsWith('blob:') || href.startsWith('data:'))) {
          process(downloadAttr, href);
          return;
        }
      } catch(e) {
        console.error(e);
      }
      return origClick.apply(this, arguments);
    };

    // 4. Intercept document click bubbling
    document.addEventListener('click', function(e) {
      const anchor = e.target.closest('a[download]');
      if (anchor && anchor.href) {
        const downloadAttr = anchor.getAttribute('download') || anchor.download;
        if (anchor.href.startsWith('blob:') || anchor.href.startsWith('data:')) {
          e.preventDefault();
          process(downloadAttr, anchor.href);
        }
      }
    }, true);
  })();
  ''';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initWebViewController();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // ── Handle downloaded files from JavaScript bridge ────────────────────────
  Future<void> _handleFileDownload(String rawJson) async {
    try {
      debugPrint('FlutterDownloadBridge received file download message');
      final data = jsonDecode(rawJson) as Map<String, dynamic>;
      final rawName = data['filename'] as String? ?? 'document.pdf';
      final fileName = rawName.replaceAll(RegExp(r'[^\w\.\-]'), '_');
      final dataUrl = data['dataUrl'] as String? ?? '';

      if (!dataUrl.contains(',')) return;
      final base64String = dataUrl.split(',').last;
      final bytes = base64Decode(base64String);

      // Determine public downloads directory on Android (/storage/emulated/0/Download)
      Directory? targetDir;
      if (Platform.isAndroid) {
        final publicDownload = Directory('/storage/emulated/0/Download');
        if (await publicDownload.exists()) {
          targetDir = publicDownload;
        }
      }
      if (targetDir == null) {
        final extDirs = await getExternalStorageDirectories(type: StorageDirectory.downloads);
        if (extDirs != null && extDirs.isNotEmpty) {
          targetDir = extDirs.first;
        }
      }
      targetDir ??= await getApplicationDocumentsDirectory();

      final file = File('${targetDir.path}/$fileName');
      await file.writeAsBytes(bytes, flush: true);
      debugPrint('File saved successfully to: ${file.path}');

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✓ Saved to Downloads: $fileName'),
          action: SnackBarAction(
            label: 'Open',
            textColor: const Color(AppConfig.accentColorHex),
            onPressed: () async {
              await OpenFilex.open(file.path);
            },
          ),
          duration: const Duration(seconds: 7),
          behavior: SnackBarBehavior.floating,
        ),
      );

      // Automatically open the downloaded file so user sees it instantly
      try {
        await OpenFilex.open(file.path);
      } catch (err) {
        debugPrint('OpenFilex error: $err');
        // Fallback to share sheet
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(file.path)],
            subject: 'Laxmi Enterprises - $fileName',
          ),
        );
      }
    } catch (e) {
      debugPrint('Error saving downloaded file: $e');
    }
  }

  // ── Native dialogs for window.alert / confirm / prompt ─────────────────────
  Future<void> _showJsAlert(JavaScriptAlertDialogRequest request) async {
    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Laxmi Enterprises'),
        content: Text(request.message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<bool> _showJsConfirm(JavaScriptConfirmDialogRequest request) async {
    if (!mounted) return false;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Action'),
        content: Text(request.message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('OK'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<String> _showJsPrompt(JavaScriptTextInputDialogRequest request) async {
    if (!mounted) return '';
    final textController = TextEditingController(text: request.defaultText);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Laxmi Enterprises'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(request.message),
            const SizedBox(height: 8),
            TextField(controller: textController, autofocus: true),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(''),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(textController.text),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    return result ?? '';
  }

  // ── WebView initialization ─────────────────────────────────────────────────
  void _initWebViewController() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF8FAFC))
      // Standard Chrome Mobile User-Agent to avoid any embedded bot blocks
      ..setUserAgent('Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36')
      ..setOnConsoleMessage((JavaScriptConsoleMessage msg) {
        debugPrint('WEB CONSOLE [${msg.level.name}]: ${msg.message}');
      })
      ..setOnJavaScriptAlertDialog(_showJsAlert)
      ..setOnJavaScriptConfirmDialog(_showJsConfirm)
      ..setOnJavaScriptTextInputDialog(_showJsPrompt)
      ..addJavaScriptChannel(
        'FlutterDownloadBridge',
        onMessageReceived: (JavaScriptMessage msg) {
          _handleFileDownload(msg.message);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            if (mounted) setState(() => _loadingProgress = progress);
          },
          onPageStarted: (String url) {
            debugPrint('WebView started loading: $url');
            if (mounted) {
              setState(() {
                _hasFatalError = false;
                _loadingProgress = 15;
              });
            }
          },
          onPageFinished: (String url) {
            debugPrint('WebView finished loading: $url');
            if (mounted) {
              setState(() {
                _hasFatalError = false;
                _loadingProgress = 100;
              });
            }
            // Inject download bridge when page finishes loading
            _controller.runJavaScript(_downloadBridgeJs);
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebResourceError: [${error.errorCode}] ${error.description} isMainFrame: ${error.isForMainFrame} url: ${error.url}');
            // ONLY show offline screen if the MAIN FRAME failed with a genuine host lookup/connect failure
            if (error.isForMainFrame == true) {
              if (error.errorType == WebResourceErrorType.hostLookup ||
                  error.errorType == WebResourceErrorType.connect ||
                  error.errorType == WebResourceErrorType.timeout) {
                if (mounted) {
                  setState(() {
                    _hasFatalError = true;
                  });
                }
              }
            }
          },
          onNavigationRequest: (NavigationRequest request) async {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.navigate;

            final scheme = uri.scheme.toLowerCase();

            // Handle phone calls (tel:), emails (mailto:), SMS (sms:)
            if (scheme == 'tel' || scheme == 'mailto' || scheme == 'sms') {
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri);
              }
              return NavigationDecision.prevent;
            }

            // Handle WhatsApp direct links (whatsapp:, wa.me, api.whatsapp.com)
            if (scheme == 'whatsapp' ||
                uri.host.contains('wa.me') ||
                uri.host.contains('whatsapp.com')) {
              try {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              } catch (_) {
                await launchUrl(uri, mode: LaunchMode.platformDefault);
              }
              return NavigationDecision.prevent;
            }

            // Handle blob: schemes (intercepted by JavaScript bridge)
            if (scheme == 'blob') {
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
        ),
      );

    // Platform-specific Android configuration
    if (_controller.platform is AndroidWebViewController) {
      final androidController = _controller.platform as AndroidWebViewController;
      androidController.setMediaPlaybackRequiresUserGesture(false);
      androidController.setOnPlatformPermissionRequest((request) {
        request.grant();
      });
    }

    _controller.loadRequest(Uri.parse(widget.initialUrl));
    _isControllerInitialized = true;
  }

  // ── Reload / Retry ─────────────────────────────────────────────────────────
  Future<void> _reloadWebView() async {
    setState(() {
      _hasFatalError = false;
      _loadingProgress = 10;
    });
    if (_isControllerInitialized) {
      await _controller.reload();
    } else {
      _initWebViewController();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (!_hasFatalError && _isControllerInitialized && await _controller.canGoBack()) {
          await _controller.goBack();
        } else {
          if (context.mounted) Navigator.of(context).maybePop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: SafeArea(
          bottom: false,
          child: _hasFatalError
              ? OfflineScreen(onRetry: _reloadWebView)
              : Stack(
                  children: [
                    // ── Main WebView (guaranteed 100% full screen fill) ───
                    if (_isControllerInitialized)
                      Positioned.fill(
                        child: WebViewWidget(controller: _controller),
                      ),

                    // ── Top loading progress bar ──────────────────────
                    if (_loadingProgress < 100)
                      Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        child: LinearProgressIndicator(
                          value: _loadingProgress / 100.0,
                          backgroundColor: Colors.transparent,
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            Color(AppConfig.secondaryColorHex),
                          ),
                          minHeight: 3,
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}
