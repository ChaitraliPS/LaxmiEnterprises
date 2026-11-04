import 'package:flutter/material.dart';
import 'dart:async';
import '../config/app_config.dart';
import 'webview_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  Timer? _transitionTimer;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _animController.forward();

    // Transition to WebViewScreen after 2.2 seconds
    _transitionTimer = Timer(const Duration(milliseconds: 2200), () {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (context, anim, secAnim) => const WebViewScreen(),
            transitionsBuilder: (context, anim, secAnim, child) {
              return FadeTransition(opacity: anim, child: child);
            },
            transitionDuration: const Duration(milliseconds: 600),
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _transitionTimer?.cancel();
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConfig.darkCanvasHex),
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Corporate Architectural Logo Emblem
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF005BB5), Color(0xFF003870)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF005BB5).withValues(alpha: 0.4),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    'L',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 50,
                      fontWeight: FontWeight.w900,
                      fontFamily: 'serif',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'LAXMI ENTERPRISES',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  letterSpacing: 2.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enterprise Business & ERP Portal',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 13,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 48),
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    Color(AppConfig.accentColorHex),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
