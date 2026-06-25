package dev.stellar.mobile;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.os.AsyncTask;
import java.io.File;

public class StellarFFmpegModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public StellarFFmpegModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "StellarFFmpeg";
    }

    @ReactMethod
    public void trimVideo(ReadableMap options, final Promise promise) {
        final String inputPath = options.getString("inputUri");
        final String outputPath = options.getString("outputUri");
        final long startMs = (long) options.getDouble("startMs");
        final long endMs = (long) options.getDouble("endMs");
        final int videoBitrate = options.hasKey("videoBitrate") ? options.getInt("videoBitrate") : 4000;
        final int audioBitrate = options.hasKey("audioBitrate") ? options.getInt("audioBitrate") : 128;
        final boolean useHardware = options.hasKey("hardwareEncoding") ? options.getBoolean("hardwareEncoding") : true;

        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                long startTime = System.currentTimeMillis();
                int result = FFmpegBridge.trimVideo(
                    inputPath,
                    outputPath,
                    startMs,
                    endMs,
                    videoBitrate,
                    audioBitrate,
                    useHardware,
                    new FFmpegBridge.ProgressCallback() {
                        @Override
                        public void onProgress(double progress) {
                            WritableMap progressMap = new WritableNativeMap();
                            progressMap.putDouble("progress", progress);
                            reactContext
                                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                .emit("StellarFFmpegProgress", progressMap);
                        }
                    }
                );

                if (result == 0) {
                    WritableMap map = new WritableNativeMap();
                    map.putString("outputUri", outputPath);
                    map.putDouble("durationMs", (double)(endMs - startMs));
                    File file = new File(outputPath);
                    map.putDouble("fileSizeBytes", (double)file.length());
                    map.putDouble("processingMs", (double)(System.currentTimeMillis() - startTime));
                    promise.resolve(map);
                } else {
                    promise.reject("TRIM_FAILED", "Native trim failed with code: " + result);
                }
            }
        });
    }
}
