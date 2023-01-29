const db = firebase.database()
const userSettings = JSON.parse(localStorage.getItem("settings"))
const saveSetting = document.getElementById("submit_settings")
const pomoDur = document.getElementById("pomoDur")
const sBrDur = document.getElementById("sBrDur")
const brDur = document.getElementById("brDur")
const noPomo = document.getElementById("noPomo")
const lBrInter = document.getElementById("lBrInter")
firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
        if (userSettings !== null && userSettings !== undefined) {
            setParams(userSettings)
        } else {
            if (window.location.href.includes("startSession")) {
                loadUserSettings(user)
            } else {
                setParams(loadUserSettings(user))
            }
        }

        saveSetting.onclick = () => {
            //save the user prefered params to the user/uid path
            db.ref('users/' + user.uid).set({
                "Pomo Duration": pomoDur.value,
                "Short Break Duration": sBrDur.value,
                "Long Break Duration": brDur.value,
                "Number Of Pomos": noPomo.value,
                "Long Break Interval": lBrInter.value
            }).then(() => {
                //update the local storage
                localStorage.setItem("settings", JSON.stringify({
                    "Pomo Duration": pomoDur.value,
                    "Short Break Duration": sBrDur.value,
                    "Long Break Duration": brDur.value,
                    "Number Of Pomos": noPomo.value,
                    "Long Break Interval": lBrInter.value
                }))
                // Data saved successfully!
                console.log("saved successully");
            }).catch((error) => {
                // The write failed...
                console.error(error);
            });
        }
    }
});

function loadUserSettings(user) {
    var userSettings;
    console.log("loading data");
    db.ref('users/' + user.uid).on("value", (snapshot) => {
        userSettings = snapshot.val()
        //setting the users params
        localStorage.setItem("settings", JSON.stringify(userSettings))
    })
    console.log(userSettings);
    return userSettings;
}
function setParams(userPreference) {
    pomoDur.value = userPreference["Pomo Duration"]
    pomoDur.nextElementSibling.value = userPreference["Pomo Duration"] + " min"

    sBrDur.value = userPreference["Short Break Duration"]
    sBrDur.nextElementSibling.value = userPreference["Short Break Duration"] + " min"

    brDur.value = userPreference["Long Break Duration"]
    brDur.nextElementSibling.value = userPreference["Long Break Duration"] + " min"

    noPomo.value = userPreference["Number Of Pomos"]
    noPomo.nextElementSibling.value = userPreference["Number Of Pomos"] + " pomos"

    lBrInter.value = userPreference["Long Break Interval"]
    lBrInter.nextElementSibling.value = userPreference["Long Break Interval"] + " SBr"
}