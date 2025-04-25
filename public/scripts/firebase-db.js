const db = firebase.database();
const saveSetting = document.getElementById("submit_settings");
const pomoDur = document.getElementById("pomoDur");
const sBrDur = document.getElementById("sBrDur");
const brDur = document.getElementById("brDur");
const noPomo = document.getElementById("noPomo");
const lBrInter = document.getElementById("lBrInter");

// Default settings to use if no saved settings exist
const DEFAULT_SETTINGS = {
    "Pomo Duration": "25",
    "Short Break Duration": "5",
    "Long Break Duration": "20",
    "Number Of Pomos": "4", 
    "Long Break Interval": "2"
};

// Add loading indicator in settings page
const addLoadingIndicator = () => {
    if (saveSetting) {
        saveSetting.innerHTML = '<span class="loading">Loading...</span>';
        saveSetting.disabled = true;
    }
};

// Remove loading indicator and restore button
const removeLoadingIndicator = () => {
    if (saveSetting) {
        saveSetting.innerHTML = 'Done';
        saveSetting.disabled = false;
    }
};

// Initialize auth state listener
firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
        // User is signed in
        addLoadingIndicator();
        
        // Try to get settings from localStorage first (for quick loading)
        const cachedSettings = getCachedSettings();
        
        if (cachedSettings) {
            // We have cached settings, use them immediately
            setParams(cachedSettings);
            removeLoadingIndicator();
            
            // Still fetch from DB to ensure we have latest settings
            fetchLatestSettings(user.uid);
        } else {
            // No cached settings, we need to wait for DB
            fetchLatestSettings(user.uid, true);
        }

        // Set up settings save handler
        if (saveSetting) {
            setupSaveHandler(user.uid);
        }
    } else {
        // User is not signed in, use default settings
        setParams(DEFAULT_SETTINGS);
        removeLoadingIndicator();
    }
});

// Get cached settings from localStorage
function getCachedSettings() {
    try {
        const settings = localStorage.getItem("settings");
        return settings ? JSON.parse(settings) : null;
    } catch (error) {
        console.error("Error parsing cached settings:", error);
        localStorage.removeItem("settings"); // Clear invalid settings
        return null;
    }
}

// Fetch latest settings from database
function fetchLatestSettings(userId, updateUI = false) {
    const settingsRef = db.ref('users/' + userId);
    
    // Use once() instead of on() to prevent multiple listeners
    settingsRef.once("value")
        .then((snapshot) => {
            const userSettings = snapshot.val() || DEFAULT_SETTINGS;
            
            // Cache settings in localStorage
            localStorage.setItem("settings", JSON.stringify(userSettings));
            
            // Update UI if requested (when no cached settings were available)
            if (updateUI) {
                setParams(userSettings);
                removeLoadingIndicator();
            }
            
            return userSettings;
        })
        .catch((error) => {
            console.error("Error fetching settings:", error);
            removeLoadingIndicator();
            
            // Use default settings on error
            if (updateUI) {
                setParams(DEFAULT_SETTINGS);
            }
        });
}

// Setup save handler for settings form
function setupSaveHandler(userId) {
    saveSetting.onclick = () => {
        // Show loading state
        saveSetting.innerHTML = "Saving...";
        saveSetting.disabled = true;
        
        const newSettings = {
            "Pomo Duration": pomoDur.value,
            "Short Break Duration": sBrDur.value,
            "Long Break Duration": brDur.value,
            "Number Of Pomos": noPomo.value,
            "Long Break Interval": lBrInter.value
        };
        
        // Save to database
        db.ref('users/' + userId).set(newSettings)
            .then(() => {
                // Update local storage with new settings
                localStorage.setItem("settings", JSON.stringify(newSettings));
                
                // Visual feedback of success
                saveSetting.innerHTML = "Saved!";
                
                // Navigate after a short delay to show "Saved!" message
                setTimeout(() => {
                    goStart();
                }, 800);
            })
            .catch((error) => {
                console.error("Failed to save settings:", error);
                saveSetting.innerHTML = "Error - Try Again";
                saveSetting.disabled = false;
            });
    };
}

// Set UI parameters from settings
function setParams(userPreference) {
    // Ensure we have valid settings or use defaults
    const settings = userPreference || DEFAULT_SETTINGS;
    
    try {
        // Pomodoro Duration
        pomoDur.value = settings["Pomo Duration"];
        pomoDur.nextElementSibling.value = settings["Pomo Duration"] + " min";
        
        // Short Break Duration
        sBrDur.value = settings["Short Break Duration"];
        sBrDur.nextElementSibling.value = settings["Short Break Duration"] + " min";
        
        // Long Break Duration
        brDur.value = settings["Long Break Duration"];
        brDur.nextElementSibling.value = settings["Long Break Duration"] + " min";
        
        // Number Of Pomodoros
        noPomo.value = settings["Number Of Pomos"];
        noPomo.nextElementSibling.value = settings["Number Of Pomos"] + " pomos";
        
        // Long Break Interval
        lBrInter.value = settings["Long Break Interval"];
        lBrInter.nextElementSibling.value = settings["Long Break Interval"] + " SBr";
    } catch (error) {
        console.error("Error setting parameters:", error);
        // If there's an error, try again with default settings
        if (userPreference !== DEFAULT_SETTINGS) {
            setParams(DEFAULT_SETTINGS);
        }
    }
}

/**
 * DoroDoro User Profile Database Handler
 * Manages user profile data in Firebase Realtime Database
 */

/**
 * Updates user profile information
 * @param {string} userId - The user's ID
 * @param {object} profileData - The data to update (username, settings, etc.)
 * @returns {Promise} - A promise that resolves when the update is complete
 */
function updateUserProfile(userId, profileData) {
  return db.ref('users/' + userId).update(profileData);
}

/**
 * Gets user profile data
 * @param {string} userId - The user's ID
 * @returns {Promise} - A promise that resolves with the user data
 */
function getUserProfile(userId) {
  return db.ref('users/' + userId).once('value').then(snapshot => {
    return snapshot.val();
  });
}

/**
 * Saves user timer settings
 * @param {string} userId - The user's ID
 * @param {object} settings - Timer settings object
 * @returns {Promise} - A promise that resolves when settings are saved
 */
function saveUserSettings(userId, settings) {
  return db.ref('users/' + userId + '/settings').set(settings);
}

/**
 * Gets user timer settings
 * @param {string} userId - The user's ID
 * @returns {Promise} - A promise that resolves with the settings object
 */
function getUserSettings(userId) {
  return db.ref('users/' + userId + '/settings').once('value').then(snapshot => {
    return snapshot.val();
  });
}

/**
 * Updates user profile when user edits their profile
 * @param {string} username - New username
 * @param {string} password - New password (optional)
 * @returns {Promise} - A promise that resolves when update is complete
 */
async function updateProfile(username, password) {
  const user = firebase.auth().currentUser;
  
  if (!user) {
    throw new Error('No user is signed in');
  }
  
  const updates = {};
  
  // Update username in Firebase Auth and database
  if (username) {
    await user.updateProfile({
      displayName: username
    });
    updates.username = username;
  }
  
  // Update password if provided
  if (password) {
    await user.updatePassword(password);
  }
  
  // Update Realtime Database if we have data to update
  if (Object.keys(updates).length > 0) {
    return updateUserProfile(user.uid, updates);
  }
  
  return Promise.resolve();
}

/**
 * Initialize the default settings for a new user
 * @param {string} userId - The user's ID
 */
function initializeUserSettings(userId) {
  const defaultSettings = {
    pomoDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 20,
    pomodoros: 4,
    longBreakInterval: 2
  };
  
  return saveUserSettings(userId, defaultSettings);
}

/**
 * Handle the profile edit form submission
 * @param {Event} event - The form submission event
 */
async function handleProfileUpdate(event) {
  if (event) event.preventDefault();
  
  const usernameField = document.getElementById('edit-username');
  const passwordField = document.getElementById('edit-password');
  
  if (!usernameField && !passwordField) {
    return;
  }
  
  const username = usernameField.value.trim();
  const password = passwordField.value.trim();
  
  // Don't update if both fields are empty
  if (!username && !password) {
    return;
  }
  
  try {
    await updateProfile(username, password);
    
    // Update UI with new username
    if (username) {
      const profileCircle = document.getElementById('circle');
      if (profileCircle) {
        profileCircle.textContent = username.charAt(0).toUpperCase();
      }
    }
    
    // Close the popup
    const popup = document.getElementById('edit-profile-popup');
    const overlay = document.getElementById('overlay');
    
    if (popup) {
      popup.style.display = 'none';
    }
    
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    // Reset form
    if (usernameField) usernameField.value = '';
    if (passwordField) passwordField.value = '';
    
    // Show success message
    alert('Profile updated successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('Failed to update profile: ' + error.message);
  }
}

/**
 * Initialize the profile edit form
 */
function initializeProfileForm() {
  const profileForm = document.getElementById('profile-edit-form');
  
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }
  
  // Set initial username in profile circle
  const user = firebase.auth().currentUser;
  if (user) {
    const profileCircle = document.getElementById('circle');
    if (profileCircle) {
      profileCircle.textContent = user.displayName ? 
        user.displayName.charAt(0).toUpperCase() : 
        user.email.charAt(0).toUpperCase();
    }
  }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize if we're on a page with the profile edit form
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      initializeProfileForm();
      
      // Initialize settings for new users
      getUserSettings(user.uid).then(settings => {
        if (!settings) {
          initializeUserSettings(user.uid);
        }
      });
    }
  });
});