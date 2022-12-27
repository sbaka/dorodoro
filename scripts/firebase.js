// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAHwYY5X50lv6eKNlvCqUGpve4zbIKU2bA",
    authDomain: "dorodoro-1234.firebaseapp.com",
    databaseURL: "https://dorodoro-1234-default-rtdb.firebaseio.com",
    projectId: "dorodoro-1234",
    storageBucket: "dorodoro-1234.appspot.com",
    messagingSenderId: "210359007345",
    appId: "1:210359007345:web:79bce9199af36c84a983d0",
    measurementId: "G-V17XVPC4KK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export { app, analytics }