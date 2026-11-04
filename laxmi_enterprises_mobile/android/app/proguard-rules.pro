# Laxmi Enterprises Mobile - ProGuard Rules
# Flutter/Dart code is AOT compiled; these rules apply only to Java/Kotlin dependencies.

# Keep Flutter wrapper classes
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# Keep WebView related classes
-keep class android.webkit.** { *; }
-keep class androidx.webkit.** { *; }

# Keep URL launcher
-keep class io.flutter.plugins.urllauncher.** { *; }

# Keep file provider (needed for sharing/opening files)
-keep class androidx.core.content.FileProvider { *; }

# Keep open_filex plugin
-keep class com.crazecoder.openfile.** { *; }

# Keep path_provider plugin
-keep class io.flutter.plugins.pathprovider.** { *; }

# Keep share_plus plugin
-keep class dev.fluttercommunity.plus.share.** { *; }

# General Android keep rules
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

