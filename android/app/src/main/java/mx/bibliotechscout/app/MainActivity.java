package mx.bibliotechscout.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeUpdaterPlugin.class);
        registerPlugin(PdfViewerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
