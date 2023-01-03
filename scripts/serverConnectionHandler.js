import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { app } from "./firebase.js"
import "./navigation.js";

const localPages = ["pages/signIn.html", "pages/signUp.html", "index.html"]
//check if the use is connected // by the session storage
const checker = localPages.some(page => window.location.href.includes(page))
const authUser = Object.keys(localStorage)
    .filter(item => item.startsWith('firebase:authUser'))[0]

if (authUser) {
    //user is signed in. Redirect to start
    //if the user is trying to reach any of these pages redirect to start 
    const user = JSON.parse(localStorage.getItem(authUser))
    if (checker) {
        //TODO: check if the email is activated before redirecting
        goStartHome()
    } else {
        // the user is logged and in the right pages
        const db = getDatabase(app);
        //wherever we are save the settings in session 
        //only store these once => check for them before adding
        const userSettings = Object.keys(localStorage)
            .filter(item => item.startsWith('settings'))[0]
        if (userSettings === undefined) {
            onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                const userSettings = snapshot.val()
                //setting the users params
                localStorage.setItem("settings", JSON.stringify(userSettings))
            })
        }
        if (window.location.href.includes("settings.html")) {
            // connect to the db
            const db = getDatabase(app);
            //the required fields
            const saveSetting = document.getElementById("submit_settings")
            const pomoDur = document.getElementById("pomoDur")
            const sBrDur = document.getElementById("sBrDur")
            const brDur = document.getElementById("brDur")
            const noPomo = document.getElementById("noPomo")
            const lBrInter = document.getElementById("lBrInter")

            //get the settings from the session storage instead of fetching them 
            const userPreference = JSON.parse(localStorage.getItem("settings"))
            //setting the users params
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

            saveSetting.onclick = () => {
                set(ref(db, 'users/' + user.uid), {
                    "Pomo Duration": pomoDur.value,
                    "Short Break Duration": sBrDur.value,
                    "Long Break Duration": brDur.value,
                    "Number Of Pomos": noPomo.value,
                    "Long Break Interval": lBrInter.value
                }).then(() => {
                    // Data saved successfully!
                    console.log("saved successully");
                }).catch((error) => {
                    // The write failed...
                    console.error(error);
                });
            }
        }
    }


} else {
    //if the user isn't signed in redirect to the sign in pages 
    //TODO: give user only access in the allowed pages

    if (!checker) {
        //redirect to the home page 
        goHome()
    }

    //if the user isn't signed in accept clicks
    //get firebase credentials
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider()

    //get the required fields
    const signInBtn = document.getElementById("sign_in_submit")
    const signUpBtn = document.getElementById("sign_up_submit")
    const googleSign = document.getElementById("sign_with_google")
    const email = document.getElementById("email")
    const password = document.getElementById("pwd")
    const userName = document.getElementById("userName")
    const errorField = document.getElementById("error")
    const errorContainer = document.getElementById("error_msg_container")
    /*sign up logic */
    if (window.location.href.includes("signUp")) {
        // register with email and pwd
        signUpBtn.onclick = function () {
            if (email.value.length > 0 && password.value.length > 0 && userName.value.length > 0) {
                createUserWithEmailAndPassword(auth, email.value, password.value)
                    .then(async (userCredential) => {
                        // Signed in 
                        const user = userCredential.user;
                        await updateProfile(user, {
                            displayName: userName.value,
                        })
                        //set the user in session
                        await setPersistence(auth, browserLocalPersistence)
                        //TODO: implement the logic that retreives the user from this place and then tests if the user is signed in
                        localStorage.setItem("user", user.displayName)
                        goStart()
                    })
                    .catch((error) => {
                        //TODO: handle errors
                        const errorCode = error.code;
                        const errorMessage = error.message;
                        //change the content of tje div and diplay it
                        errorContainer.innerHTML = errorMessage
                        errorField.style.display = "flex"
                    });
            }
        }
        /*register with google logic */
        googleSign.onclick = function () {
            signInWithPopup(auth, provider)
                .then(async (result) => {
                    // This gives you a Google Access Token. You can use it to access the Google API.
                    const credential = GoogleAuthProvider.credentialFromResult(result);
                    const token = credential.accessToken;
                    // The signed-in user info.
                    await setPersistence(auth, browserLocalPersistence)
                    const user = result.user;
                    console.log(user);
                    goStartHome()
                    // ...
                }).catch((error) => {
                    // Handle Errors here.
                    const errorCode = error.code;
                    var errorMessage = "iniErr: " + error.message;
                    // The email of the user's account used.
                    const email = "em: " + error.customData.email;
                    // The AuthCredential type that was used.
                    const credential = "cred: " + GoogleAuthProvider.credentialFromError(error);
                    //TODO: handle errors
                    //change the content of tje div and diplay it
                    errorMessage += " " + email + " " + credential
                    errorContainer.innerHTML = errorMessage
                    errorField.style.display = "flex"
                });
        }
    } else if (window.location.href.includes("signIn")) {
        /*login logic */
        signInBtn.onclick = function () {
            if (email.value.length > 0 && password.value.length > 0) {
                setPersistence(auth, browserLocalPersistence)
                    .then(() => {
                        signInWithEmailAndPassword(auth, email.value, password.value).then((_) => {
                            goStart()
                        })
                    })
                    .catch((error) => {
                        //TODO: handle errors
                        const errorCode = error.code;
                        const errorMessage = error.message;
                        //change the content of tje div and diplay it
                        errorContainer.innerHTML = errorMessage
                        errorField.style.display = "flex"
                    });
            } else {
                //TODO: handle errors
                alert("No Input can be empty")
            }
        }
    }




}

