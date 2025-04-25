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