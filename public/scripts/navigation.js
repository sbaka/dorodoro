//set the webpage logo
var link = document.querySelector("link[rel~='icon']");
if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(link);
}
link.href = "../assets/Logo.ico"


// //navigation
// function goSignIn() {
//     location.href = "https://dorodoro-1234.web.app/pages/signIn.html";
// };

// function goSignUp() {
//     location.href = "https://dorodoro-1234.web.app/pages/signUp.html";
// };

// function goHome() {
//     location.href = "https://dorodoro-1234.web.app/index.html"
// }
// function goStart() {
//     location.href = "https://dorodoro-1234.web.app/pages/start.html"
// }
// function goSettings() {
//     location.href = "https://dorodoro-1234.web.app/pages/settings.html"
// }

// function goStartHome() {
//     location.href = "https://dorodoro-1234.web.app/pages/startSession.html"
// }

//navigation
function goSignIn() {
    location.href = "/signIn.html";
};

function goSignUp() {
    location.href = "/signUp.html";
};

function goHome() {
    location.href = "/index.html"
}
function goStart() {
    location.href = "/start.html"
}
function goSettings() {
    location.href = "/settings.html"
}

function goStartHome() {
    location.href = "/startSession.html"
}
