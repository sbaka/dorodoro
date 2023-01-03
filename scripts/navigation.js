//navigation
function goSignIn() {
    location.href = "https://abdellatif-kbr.me/dorodoro/pages/signIn.html";
};

function goSignUp() {
    location.href = "https://abdellatif-kbr.me/dorodoro/pages/signUp.html";
};

function goHome() {
    location.href = "https://abdellatif-kbr.me/dorodoro/index.html"
}
function goStart() {
    location.href = "https://abdellatif-kbr.me/dorodoro/pages/start.html"
}
function goSettings() {
    location.href = "https://abdellatif-kbr.me/dorodoro/pages/settings.html"
}

function goStartHome() {
    location.href = "https://abdellatif-kbr.me/dorodoro/pages/startSession.html"
}
//set the webpage logo
var link = document.querySelector("link[rel~='icon']");
if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(link);
}
link.href = "../assets/Logo.ico"