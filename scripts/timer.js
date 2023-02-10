const countdownNumberEl = document.getElementById('countdown-number');
const start = document.getElementById("start");
const pomoType = document.getElementById("pomo-type");

const timer = {
    POMO: 1,
    SBREAK: 2,
    LBREAK: 3,
}



//get user perference 
settings = JSON.parse(localStorage.getItem('settings'))
//if there is no settings yet use defaults
if (settings === null) {
    settings = {
        "Pomo Duration": "25",
        "Short Break Duration": "5",
        "Long Break Duration": "15",
        "Long Break Interval": "2",
        "Number Of Pomos": "1"
    }
}


// get initial countdown from user preferences
//minToSec(parseInt(settings["Pomo Duration"]))
const POMO_DURATION = minToSec(parseInt(settings["Pomo Duration"])); // user timer
const SHORT_BREAK = minToSec(parseInt(settings["Short Break Duration"]));
const LONG_BREAK = minToSec(parseInt(settings["Long Break Duration"]))
const LONG_BREAK_INTERVAL = minToSec(parseInt(settings["Long Break Interval"]))
const REPETITION = minToSec(parseInt(settings["Number Of Pomos"]))


/*
1- A pomo cycle is 1 study-timer + 1 rest_timer
2- after LONG_BREAK_INTERVAL times => start a longbreak
3- stop after POMOS_NUM reaches 0 (decrements)
 */

countdownNumberEl.innerHTML = secondsToMinutes(POMO_DURATION);
pomoType.innerHTML = "Time to focus"
//its = to 1 bcz after the first timer it should start a long timer 
let count = 1;
let currentTimerID;
let timeLeft = POMO_DURATION;
let started = false
let state = timer.POMO // this can have 3 states pomo/sbreak/lbreak


let pomoAnimation = animate(POMO_DURATION);
let sBrAnimation = animate(SHORT_BREAK);
let lBrAnimation = animate(LONG_BREAK);
pomoAnimation.pause()
lBrAnimation.pause()
sBrAnimation.pause()



start.onclick = () => {
    switch (state) {
        case timer.POMO:
            pomoType.innerHTML = "Time to focus"
            pomoTimer(timeLeft)
            break;
        case timer.SBREAK:
            pomoType.innerHTML = "Relax a little"
            breakTimer(timeLeft, timer.SBREAK)
            break;
        case timer.LBREAK:
            pomoType.innerHTML = "What about a fresh breeze ?"
            breakTimer(timeLeft, timer.LBREAK)
            break;
        default:
            break;
    }
}


//pomo
function pomoTimer(duration) {
    timeLeft = duration;
    countdownNumberEl.innerHTML = secondsToMinutes(timeLeft);
    if (!started) {
        pomoAnimation.play()
        currentTimerID = setInterval(() => {
            timeLeft--;
            countdownNumberEl.innerHTML = secondsToMinutes(timeLeft);
            if (timeLeft < 1) {
                if (count < REPETITION) {
                    //eleminate the first br to be a long one  && count !== 0
                    console.log((count % LONG_BREAK_INTERVAL), count);
                    if ((count % LONG_BREAK_INTERVAL) == 0) {
                        state = timer.LBREAK
                        timeLeft = LONG_BREAK
                    } else {
                        timeLeft = SHORT_BREAK
                        state = timer.SBREAK
                    }
                }
                clearInterval(currentTimerID)
                started = false;
            }
        }, 1000);
        start.textContent = "Pause"
        start.style.backgroundColor = "#D92828"
        started = true
    } else {
        start.textContent = "Resume"
        start.style.backgroundColor = "#2ecc71"
        pomoAnimation.pause()
        clearInterval(currentTimerID)
        started = false;
    }
}

//break
function breakTimer(duration, type) {
    timeLeft = duration;
    countdownNumberEl.innerHTML = secondsToMinutes(duration);
    if (!started) {
        type == timer.LBREAK ? lBrAnimation.play() : sBrAnimation.play();
        currentTimerID = setInterval(() => {
            timeLeft--;
            countdownNumberEl.innerHTML = secondsToMinutes(timeLeft);
            if (timeLeft < 1) {
                if (count < REPETITION) {
                    count++;
                    state = timer.POMO
                    timeLeft = POMO_DURATION
                }
                clearInterval(currentTimerID)
                started = false
            }
        }, 1000);
        start.textContent = "Pause"
        start.style.backgroundColor = "#D92828"
        started = true
    } else {
        start.textContent = "Resume"
        start.style.backgroundColor = "#2ecc71"
        type == timer.LBREAK ? lBrAnimation.pause() : sBrAnimation.pause();
        clearInterval(currentTimerID)
        started = false
    }
}

function animate(duration) {
    return anime({
        targets: '#ring',
        strokeDashoffset: [0, anime.setDashoffset],
        easing: 'linear',
        duration: duration * 1000,
        // direction: 'alternate',
    });
}


//converstion
function msToMinutes(ms) {
    return Math.floor(ms / 60000)
}
function minToSec(min) {
    return min * 60
}
function secondsToMinutes(s) {
    if (s < 60) {
        s = s.toLocaleString('en-US', {
            minimumIntegerDigits: 2,
            useGrouping: false
        })
        return "00:" + s
    } else {
        m = Math.floor(s / 60)
        m = m.toLocaleString('en-US', {
            minimumIntegerDigits: 2,
            useGrouping: false
        })
        s = (s % 60).toLocaleString('en-US', {
            minimumIntegerDigits: 2,
            useGrouping: false
        })
        return m + ":" + s
    }
}




// //short break
// function shortBrTimer() {
//     console.log("short br started");
//     timeLeft = SHORT_BREAK;
//     animation = animate(timeLeft)
//     if (!started) {
//         animation.play()
//         currentTimer = setInterval(() => {
//             timeLeft--;
//             countdownNumberEl.innerHTML = secondsToMinutes(timeLeft);
//             if (timeLeft < 1) {
//                 if (count < REPETITION) {
//                     count++;
//                     pomoTimer()
//                 }
//                 clearInterval(currentTimer)
//                 started = !started
//             }
//         }, 1000);
//         started = !started
//     } else {
//         animation.pause()
//         clearInterval(currentTimer)
//     }
// }