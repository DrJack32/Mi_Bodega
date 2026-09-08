const fs = require("fs");
const path = require("path");
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require("expo/config-plugins");

const PACKAGE_NAME = "com.drjack32.mibodega";
const MODULE_PACKAGE = `${PACKAGE_NAME}.mlkit`;
const DEPENDENCY = 'implementation("com.google.mlkit:text-recognition:16.0.1")';

const moduleSource = `package ${MODULE_PACKAGE}

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

class MiBodegaMlKitOcrModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MiBodegaMlKitOcr"

  @ReactMethod
  fun recognize(uriString: String, promise: Promise) {
    try {
      val image = InputImage.fromFilePath(reactContext, Uri.parse(uriString))
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

      recognizer.process(image)
        .addOnSuccessListener { result ->
          promise.resolve(result.text)
        }
        .addOnFailureListener { error ->
          promise.reject("MLKIT_OCR_FAILED", error.message, error)
        }
        .addOnCompleteListener {
          recognizer.close()
        }
    } catch (error: Exception) {
      promise.reject("MLKIT_OCR_INPUT_FAILED", error.message, error)
    }
  }
}
`;

const packageSource = `package ${MODULE_PACKAGE}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MiBodegaMlKitOcrPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(MiBodegaMlKitOcrModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> {
    return emptyList()
  }
}
`;

function writeNativeFiles(androidRoot) {
  const packageDir = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    ...PACKAGE_NAME.split("."),
    "mlkit",
  );

  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, "MiBodegaMlKitOcrModule.kt"), moduleSource);
  fs.writeFileSync(path.join(packageDir, "MiBodegaMlKitOcrPackage.kt"), packageSource);
}

function addDependency(contents) {
  if (contents.includes(DEPENDENCY)) return contents;
  return contents.replace(
    /dependencies\s*\{/,
    `dependencies {\n    ${DEPENDENCY}`,
  );
}

function addPackage(contents) {
  const importLine = `import ${MODULE_PACKAGE}.MiBodegaMlKitOcrPackage`;
  let next = contents.includes(importLine)
    ? contents
    : contents.replace(
        "import expo.modules.ReactNativeHostWrapper",
        `import expo.modules.ReactNativeHostWrapper\n${importLine}`,
      );

  const packageLine = "              add(MiBodegaMlKitOcrPackage())";
  if (next.includes(packageLine)) return next;

  return next.replace(
    "              // add(MyReactNativePackage())",
    `              // add(MyReactNativePackage())\n${packageLine}`,
  );
}

module.exports = function withMlKitOcr(config) {
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = addDependency(config.modResults.contents);
    return config;
  });

  config = withMainApplication(config, (config) => {
    config.modResults.contents = addPackage(config.modResults.contents);
    return config;
  });

  config = withDangerousMod(config, [
    "android",
    (config) => {
      writeNativeFiles(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);

  return config;
};
