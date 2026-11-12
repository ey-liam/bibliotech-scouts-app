# Reglas ProGuard / R8 para BiblioTech Scout (Capacitor 8 + Plugins nativos)
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Conservar clases y métodos nativos propios registrados en BridgeActivity
-keep class mx.bibliotechscout.app.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @android.webkit.JavascriptInterface <methods>;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
