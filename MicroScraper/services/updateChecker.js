import { Alert, Linking } from 'react-native';
import versionInfo from '../version.json';

// Configure your GitHub repo here
const GITHUB_OWNER = 'gnhen'; 
const GITHUB_REPO = 'Micro-SKU-App'; 
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Compare version strings (e.g., "0.1.1" vs "0.1.2")
const compareVersions = (v1, v2) => {
  // Remove 'v' prefix if present and split by dot
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1; // v1 is greater
    if (part1 < part2) return -1; // v2 is greater
  }
  
  return 0; // Equal
};

export const checkForUpdates = async () => {
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
    
    // Check if latestVersion is actually newer than currentVersion
    // compareVersions returns -1 if current < latest
    const comparison = compareVersions(currentVersion, latestVersion);
    
  
    if (comparison >= 0) {
      console.log('[Update] App is up to date.');
      Alert.alert(
        'Already up to date', 
        `You're running the latest version (${currentVersion}).`
      );
      return;
    }
    
    // Update is available
    Alert.alert(
      'Update Available',
      `A new version (${latestVersion}) is available!\n\nCurrent version: ${currentVersion}\n\nWould you like to view the release?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel' 
        },
        { 
          text: 'Update', 
          onPress: () => Linking.openURL(GITHUB_RELEASE_URL)
        }
      ]
    );
    
  } catch (error) {
    console.error('[Update] Error checking for updates:', error);
    // Optional: Only show error alert if you want the user to know the check failed
    // Alert.alert('Update Check Failed', error.message);
  }
};