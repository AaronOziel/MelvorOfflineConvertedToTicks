let ctx;
let settings;
const DEBUG = true;
const hour = 1;
const hourArray = [2, 4, 8, 16];
const minute = hour / 60;
const minuteArray = [5, 15, 30, 60];
const msPerHour = 60 * 60 * 1000;

export async function setup(gameContext) {
    ctx = gameContext;

    createSettings();

    ctx.onCharacterSelectionLoaded(() => {
        patchMinibar(); // Minibar icon.
    });

    ctx.onCharacterLoaded(() => {
        interceptOfflineProgress();
    });

    ctx.onInterfaceReady(() => {
        additionalMinibarPatches();
        headerMainMenuDisplay();
    });
}

// CREATE UI ELEMENTS

function headerMainMenuDisplay() {
    ui.create(
        createHeaderTimeDisplay({ text: formatTimeForDisplay(getPlayerTime()) }),
        document.getElementById("header-theme").getElementsByClassName("d-flex align-items-right")[0]
    );
    ui.create(createTimeSkipDisplay(), document.getElementById("time-skip-display-panel"));
    let menu = document.getElementById("time-skip-menu");
    menu.appendChild(createTimeSkipButtonArray());
    menu.style.display = "none";
    menu.addEventListener("mouseleave", () => (menu.style.display = "none"));
    document.getElementById("time-skip-display-button").style.fontFamily = "Fira Mono";
}

function updateTimeDisplays() {
    const time = formatTimeForDisplay(getPlayerTime());
    document.getElementById("time-skip-display-button").textContent = time;
    document.getElementById("octtSmall2").innerText = "\nTime: " + time;
}

function patchMinibar() {
    ctx.patch(Minibar, "initialize").after(() => {
        game.minibar.minibarElement.prepend(
            game.minibar.createMinibarItem("minibar-timeSkip", `${CDNDIR}assets/media/skills/astrology/arachi.svg`, "", {
                onClick: () => document.getElementById("hover-timeSkip").classList.remove("d-none"),
            }).element
        );
    });
}

function additionalMinibarPatches() {
    // Welcome to my spaghetti code. Don't bother trying to understand.
    const hover_timeSkip = document.getElementById("skill-footer-minibar-items-container").cloneNode();
    hover_timeSkip.id = "hover-timeSkip";
    hover_timeSkip.classList.add("d-none");
    hover_timeSkip.style.maxWidth = "300";
    document.getElementById("skill-footer-minibar-items-container").parentElement.appendChild(hover_timeSkip);
    const span = hover_timeSkip.appendChild(document.createElement("span"));
    span.className = "font-size-sm text-center text-white";
    const small = span.appendChild(document.createElement("small"));
    small.textContent = "Time Skip";
    const small2 = small.appendChild(document.createElement("small"));
    small2.id = "octtSmall2";
    small2.innerText = "\nTime: " + formatTimeForDisplay(getPlayerTime());
    const buttonContainer = createTimeSkipButtonArray();
    buttonContainer.style.gridTemplateColumns = "repeat(2,1fr)";
    const minibar_timeSkip = document.getElementById("minibar-timeSkip");
    minibar_timeSkip.addEventListener("mouseover", () => hover_timeSkip.classList.remove("d-none"));
    minibar_timeSkip.addEventListener("mouseleave", () => hover_timeSkip.classList.add("d-none"));
    if (settings.section("Time skip menu in skill minibar").get("show-mini-bar") == false) {
        minibar_timeSkip.classList.add("d-none");
    }
    hover_timeSkip.addEventListener("mouseover", () => hover_timeSkip.classList.remove("d-none"));
    hover_timeSkip.addEventListener("mouseleave", () => hover_timeSkip.classList.add("d-none"));
    hover_timeSkip.appendChild(buttonContainer);
}

function createHeaderTimeDisplay(props) {
    return {
        $template: "#time-skip-display",
        timeAsString: props.text,
        click() {
            let menu = document.getElementById("time-skip-menu");
            // Invert menu display
            menu.style.display = menu.style.display == "none" ? "block" : "none";
            if (DEBUG) {
                ctx.characterStorage.setItem("offline_time", getPlayerTime() + Math.floor(Math.random() * msPerHour * 24)); // Give a (0-1) days worth of time on press.
                updateTimeDisplays();
            }
        },
    };
}

function createTimeSkipDisplay(props) {
    return {
        $template: "#time-skip-menu",
    };
}

function createTimeSkipButtonArray() {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "grid";
    buttonContainer.style.gridTemplateColumns = "repeat(4,1fr)";
    buttonContainer.style.margin = "0px 0px 10px 10px";
    function addButtons(type, arr) {
        for (const time of arr) {
            const button = document.createElement("button");
            button.className = "btn btn-sm btn-outline-secondary overlay-container overlay-bottom skill-icon-sm font-w700 font-size-xs mb-0 text-white";
            button.style.backgroundColor = "black";
            button.textContent = time + type;
            button.style.display = "grid";
            button.style.justifyContent = "center";
            const minOrHour = type === "m" ? minute : hour;
            button.addEventListener("click", () => {
                simulateTime(time * minOrHour);
            });
            buttonContainer.appendChild(button);
        }
    }
    addButtons("m", minuteArray);
    addButtons("h", hourArray);
    return buttonContainer;
}

function createSettings() {
    settings = ctx.settings;
    settings.section("Time skip menu in skill minibar").add({
        type: "switch",
        name: "show-mini-bar",
        label: "show",
        hint: "",
        default: true,
        onChange: (newValue, oldValue) => {
            if (newValue) {
                document.getElementById("minibar-timeSkip").classList.remove("d-none");
            } else {
                document.getElementById("minibar-timeSkip").classList.add("d-none");
            }
        },
    });

    settings.section("Offline Time Multiplier").add({
        type: "number",
        name: "offline-time-multiplier",
        label: "Since time skipping is 100% efficient with next to nothing wasted, it may be more realistic to only get some fraction of offline time since it is now more valuable than normal.",
        hint: "[10 - 0.1]",
        default: 0.8,
        min: 0.1,
        max: 10,
        onChange: (value, previousValue) => {
            try {
                // This whole thing may be unnecessary
                let multiplier = parseFloat(value).toFixed(2);
                multiplier = Math.round((multiplier + Number.EPSILON) * 100) / 100;
                if (multiplier < 0.1 || multiplier > 10) {
                    displayTimeSkipToast(`"${multiplier}" is not a valid time multiplier [Min = 0.1, Max = 10]`, "danger");
                    return false;
                }
                return true;
            } catch {
                displayTimeSkipToast(`"${value}" is not a valid number [Min = 0.1, Max = 10]`, "danger");
            }
            7;
        },
    });

    settings.section("Maximum Offline Time").add({
        type: "number",
        name: "max-offline-time",
        label: "Maximum number of offline hours that can accumulate.",
        hint: "[Base game is 24hrs, -1 = infinite]",
        default: 24,
        min: -1,
    });
}

// FUNCTIONALITY

function simulateTime(hours) {
    // Stop a time skip if no action is in progress
    if (game.activeAction === undefined) {
        displayTimeSkipToast(`No active action, won't skip time while not training`, "danger");
        return;
    }
    // Compute if sufficient time is available
    let timeToSimulate = hours * msPerHour;
    let player_offline_time = getPlayerTime();
    if (player_offline_time < timeToSimulate) {
        displayTimeSkipToast("Insufficient time available to skip that much time.", "danger");
        return;
    }
    // Hide UI if it is visible
    if (swal.isVisible()) swal.close();
    document.getElementById("time-skip-menu").style.display = "none";
    // Preform time skip and subtract used time
    game.testForOffline(hours);
    game.township.availableGameTicksToSpend += Math.floor((hours * 60) / (game.township.TICK_LENGTH / 60));
    game.township.renderQueue.ticksAvailable = true;
    ctx.characterStorage.setItem("offline_time", player_offline_time - timeToSimulate);
    console.log(`Successfully spent ${timeToSimulate} time [${player_offline_time} -> ${getPlayerTime()}]`);
    // Update button text and minibar text to display new correct time
    updateTimeDisplays();
}

function interceptOfflineProgress() {
    ctx.patch(Game, "processOffline").replace((originalMethod, isModCall) => {
        console.log(`Process offline: ${isModCall}`);
        if (!isModCall) {
            // Intercept offline time
            let newTime = Date.now() - game.tickTimestamp;
            if (settings.section("Maximum Offline Time").get("max-offline-time") > 0) {
                // cap offline time if set
                newTime = Math.min(newTime, settings.section("Maximum Offline Time").get("max-offline-time") * msPerHour);
            }
            newTime *= settings.section("Offline Time Multiplier").get("offline-time-multiplier");
            ctx.characterStorage.setItem("offline_time", getPlayerTime() + newTime);
            // Reset 'last seen' to now
            // TODO: Not sure if even needed...
            game.tickTimestamp = Date.now();
            displayTimeSkipToast(`Away for ${formatTimeForDisplay(newTime)}, time recorded`, "success");
        } else {
            originalMethod();
        }
    });

    // Help processOffline differentiate between time skip call and offline progress call.
    ctx.patch(Game, "testForOffline").replace((originalMethod, timeToGoBack) => {
        // Everything from the original testForOffline().
        return __awaiter(game, void 0, void 0, function* () {
            game.stopMainLoop();
            console.log("Going back in time - " + timeToGoBack);
            game.tickTimestamp -= timeToGoBack * msPerHour;
            saveData("all");
            // Except that processOffline() is passed true.
            yield game.processOffline(true);
            game.startMainLoop();
        });
    });
}

function formatTimeForDisplay(time) {
    // Calculate totals
    const totalSeconds = parseInt(Math.floor(time / 1000));
    const totalMinutes = parseInt(Math.floor(totalSeconds / 60));
    const totalHours = parseInt(Math.floor(totalMinutes / 60));
    const days = parseInt(Math.floor(totalHours / 24));
    // Add leading 0s if necessary
    const minutes = (totalMinutes % 60).toString().padStart(2, "0");
    const hours = (totalHours % 24).toString().padStart(2, "0");
    // Time is `hh mm` by default, add `dd` if hours > 24
    let timeDisplayString = `${hours}h ${minutes}m`;
    if (days > 0) timeDisplayString = `${days}d ${timeDisplayString}`;
    return timeDisplayString;
}

function getPlayerTime() {
    let time = parseInt(ctx.characterStorage.getItem("offline_time"));
    return time === undefined || isNaN(time) ? 0 : time;
}

function displayTimeSkipToast(message, badge = "info", duration = 5000) {
    /* Badges are:
        - primary: blue
        - secondary: grey
        - success: green
        - info: light blue
        - warning: yellow
        - danger: red
        - dark: dark grey
    */
    fireBottomToast(
        `<div class="text-center">
            <img class="notification-img" src="https://cdn.melvor.net/core/v018/assets/media/skills/astrology/arachi.svg">
            <span class="badge badge-${badge}">${message}</span>
        </div>`,
        duration
    );
}
