import * as FileSystem from 'expo-file-system';
import { Platform, Alert, Linking } from 'react-native';
import versionInfo from '../version.json';

// Configure your GitHub repo here
const GITHUB_OWNER = 'gnhen'; // TODO: Update this
const GITHUB_REPO = 'Micro-SKU-App'; // TODO: Update if different
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Compare version strings (e.g., "0.1.1" vs "0.1.2")
const compareVersions = (v1, v2) => {
  const parts1 = v1.replace('v', '').split('.').map(Number);
  const parts2 = v2.replace('v', '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
};

export const checkForUpdates = async () => {
  if (Platform.OS !== 'android') {
    Alert.alert('Update Not Available', 'Auto-update is only available for Android.');
    return;
  }

  try {
    console.log('[Update] Checking for updates...');
    const response = await fetch(GITHUB_API_URL);
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const releaseData = await response.json();
    const latestVersion = releaseData.tag_name; // e.g., "v0.1.2"
    const currentVersion = `v${versionInfo.version}`; // e.g., "v0.1.1"
    
    console.log(`[Update] Current: ${currentVersion}, Latest: ${latestVersion}`);
    
    const comparison = compareVersions(currentVersion, latestVersion);
    
    if (comparison >= 0) {
      Alert.alert('Up to Date', `You're running the latest version (${currentVersion})`);
      return;
    }
    
    // Find the APK asset
    const apkAsset = releaseData.assets.find(asset => 
      asset.name.endsWith('.apk')
    );
    
    if (!apkAsset) {
      throw new Error('No APK file found in latest release');
    }
    
    console.log(`[Update] Found APK: ${apkAsset.name}`);
    
    Alert.alert(
      'Update Available',
      `A new version (${latestVersion}) is available!\n\nCurrent version: ${currentVersion}\n\nWould you like to download and install it?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Update', 
          onPress: () => downloadAndInstallUpdate(apkAsset.browser_download_url, apkAsset.name)
        }
      ]
    );
    
  } catch (error) {
    console.error('[Update] Error checking for updates:', error);
    Alert.alert(
      'Update Check Failed',
      `Could not check for updates: ${error.message}\n\nMake sure to update GITHUB_OWNER in updateChecker.js`
    );
  }
};

const downloadAndInstallUpdate = async (downloadUrl, fileName) => {
  try {
    console.log(`[Update] Downloading from: ${downloadUrl}`);
    
    Alert.alert('Downloading...', 'Please wait while the update downloads.');
    
    const fileUri = FileSystem.documentDirectory + fileName;
    
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        console.log(`[Update] Download progress: ${(progress * 100).toFixed(0)}%`);
      }
    );
    
    const { uri } = await downloadResumable.downloadAsync();
    console.log(`[Update] Downloaded to: ${uri}`);
    
    Alert.alert(
      'Download Complete',
      'The update has been downloaded. Opening installer...',
      [
        {
          text: 'Install',
          onPress: async () => {
            // Open the APK file for installation
            const contentUri = await FileSystem.getContentUriAsync(uri);
            console.log(`[Update] Opening content URI: ${contentUri}`);
            
            await Linking.openURL(contentUri);
          }
        }
      ]
    );
    
  } catch (error) {
    console.error('[Update] Error downloading update:', error);
    Alert.alert('Download Failed', `Could not download update: ${error.message}`);
  }
};
