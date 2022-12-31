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

var popupShown = false
document.getElementById("circle").onclick = () => {
    var popup = document.getElementById("popup_sign");
    popup.classList.toggle("show");
}