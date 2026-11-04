/// Global Application Configuration for Laxmi Enterprises Flutter WebApp
class AppConfig {
  /// Live Production Web URL for the ERP portal frontend.
  static const String initialUrl = 'https://laxmienterprises.shivcoretech.com';

  /// Live Production Backend API Service URL.
  static const String backendUrl = 'https://darkcyan-buffalo-697008.hostingersite.com';

  /// Cache-busting: Keep false in production so that user authentication tokens,
  /// session credentials, and offline cache are preserved across app launches.
  static const bool clearCacheOnLaunch = false;

  /// App Name
  static const String appTitle = 'Laxmi Enterprises ERP';

  /// Corporate Brand Colors
  static const int primaryColorHex = 0xFF005BB5; // Sapphire Blue
  static const int secondaryColorHex = 0xFF00B4D8; // Electric Cyan
  static const int accentColorHex = 0xFFD4AF37; // Champagne Gold
  static const int darkCanvasHex = 0xFF090E17; // Midnight Slate
}
