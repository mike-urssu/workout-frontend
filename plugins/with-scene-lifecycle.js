// iOS 27 kills apps at launch unless they adopt the UIScene life cycle.
// Expo 57 ships ExpoAppSceneDelegate but its template doesn't wire it up yet; this does.
// Drop this plugin once `npx expo prebuild` generates a SceneManifest on its own.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

module.exports = (config) => {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
        ],
      },
    };
    return c;
  });
  return withAppDelegate(config, (c) => {
    let src = c.modResults.contents;
    src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    // The scene delegate creates the window and starts React Native into it.
    src = src.replace(/#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow[\s\S]*?#endif\n/, '');
    if (!src.includes('ExpoReactNativeFactoryProvider {') || src.includes('window = UIWindow')) {
      throw new Error('with-scene-lifecycle: AppDelegate.swift template changed; update the plugin.');
    }
    c.modResults.contents = src;
    return c;
  });
};
