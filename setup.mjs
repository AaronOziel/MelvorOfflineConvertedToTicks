let ctx;
let settings;
let logo;
const DEBUG = false;
const hour = 1;
const hourArray = [1, 4, 8, "X"];
const minute = hour / 60;
const minuteArray = [5, 15, 30, "X"];
const msPerHour = 60 * 60 * 1000;

export async function setup(gameContext) {
    ctx = gameContext;
    logo = ctx.getResourceUrl("assets/OfflineTimeBankLogo.png");

    createSettings();

    ctx.onCharacterSelectionLoaded(() => {
        patchMinibar(); // Minibar icon.
    });

    ctx.onCharacterLoaded(() => {
        interceptOfflineProgress();
    });

    ctx.onInterfaceReady(() => {
        headerMainMenuDisplay();
        additionalHeaderPatches();
        additionalMinibarPatches();
        patchSidebar();

        ctx.api({
            simulateTime: (hours) => simulateTime(hours),
            addTimeInTicks: (ms) => depositTimeInMs(ms),
            addTimeInHours: (hours) => depositTimeInHours(hours),
        });
    });
}

// CREATE UI ELEMENTS

function headerMainMenuDisplay() {
    ui.create(
        createHeaderTimeDisplay({
            text: formatTimeForDisplay(getPlayerTime()),
        }),
        document.getElementById("header-theme").getElementsByClassName("d-flex align-items-right")[0]
    );
    ui.create(createTimeBankDisplay(), document.getElementById("time-bank-display-panel"));
    let menu = document.getElementById("time-bank-menu");
    menu.appendChild(createTimeBankButtonArray());
    menu.style.display = "none";
    menu.addEventListener("mouseleave", () => (menu.style.display = "none"));
    document.getElementById("time-bank-display-button").style.fontFamily = "Fira Mono";
}

function updateTimeDisplays() {
    const formattedTimeString = formatTimeForDisplay(getPlayerTime());
    try {
        // These may not exist yet
        document.getElementById("time-bank-display-button").textContent = formattedTimeString;
        document.getElementById("time-bank-minibar").innerText = "\nTime: " + formattedTimeString;
        sidebar.category("").item("time-bank-sidebar").subitem("time-banked", {
            aside: formattedTimeString,
        });
    } catch {}
}

function patchSidebar() {
    let showSidebar = settings.section("Where to show button").get("show-sidebar");

    sidebar.category("").item("time-bank-sidebar", {
        icon: logo,
        name: "Offline Time Bank",
        after: "melvorD:Bank",
        rootClass: showSidebar ? null : "d-none",
    });

    sidebar
        .category("")
        .item("time-bank-sidebar")
        .subitem("time-banked", {
            name: "Banked",
            aside: formatTimeForDisplay(getPlayerTime()),
        });

    let type = "m";
    for (let minutes of minuteArray) {
        let hours = minutes / 60;
        let onClickFunc = () => simulateTime(hours);
        if (minutes === "X") {
            onClickFunc = () => onClickSpendX("m");
        }
        sidebar
            .category("")
            .item("time-bank-sidebar")
            .subitem(`spend-${hours}`, {
                name: `Spend ${minutes} ${type === "h" ? "Hours" : "Minutes"}`,
                onClick: onClickFunc,
            });
    }

    type = "h";
    for (let hours of hourArray) {
        let onClickFunc = () => simulateTime(hours);
        if (hours === "X") {
            onClickFunc = () => onClickSpendX("h");
        }
        sidebar
            .category("")
            .item("time-bank-sidebar")
            .subitem(`spend-${hours}`, {
                name: `Spend ${hours} ${type === "h" ? "Hours" : "Minutes"}`,
                onClick: onClickFunc,
            });
    }
}

function patchMinibar() {
    ctx.patch(Minibar, "initialize").after(() => {
        game.minibar.minibarElement.prepend(
            game.minibar.createMinibarItem("minibar-TimeBank", logo, "", {
                onClick: () => document.getElementById("hover-TimeBank").classList.remove("d-none"),
            }).element
        );
    });
}

function additionalHeaderPatches() {
    const header_TimeBank = document.getElementById("time-bank-display-panel");
    if (settings.section("Where to show button").get("show-header") == false) {
        header_TimeBank.classList.remove("d-inline-block");
        header_TimeBank.classList.add("d-none");
    }
}

function additionalMinibarPatches() {
    // Welcome to my spaghetti code. Don't bother trying to understand.
    const hover_TimeBank = document.getElementById("skill-footer-minibar-items-container").cloneNode();
    hover_TimeBank.id = "hover-TimeBank";
    hover_TimeBank.classList.add("d-none");
    hover_TimeBank.style.minWidth = "200px";
    document.getElementById("skill-footer-minibar-items-container").parentElement.appendChild(hover_TimeBank);
    const span = hover_TimeBank.appendChild(document.createElement("span"));
    span.className = "text-center text-white";
    span.style.fontSize = "24px";
    const small = span.appendChild(document.createElement("small"));
    small.textContent = "Time Bank";
    small.style.fontWeight = "bold";
    const small2 = small.appendChild(document.createElement("small"));
    small2.id = "time-bank-minibar";
    small2.innerText = "\nTime: " + formatTimeForDisplay(getPlayerTime());
    const buttonContainer = createTimeBankButtonArray();
    buttonContainer.style.gridTemplateColumns = "repeat(2,1fr)";

    // Keep menu open for 50ms so it does not close too quickly
    let hideTooltipId;
    let mouseOver = () => {
        if (hideTooltipId) {
            clearInterval(hideTooltipId);
            hideTooltipId = undefined;
        }
        hover_TimeBank.classList.remove("d-none");
    };
    let mouseLeave = () => {
        if (hideTooltipId) clearInterval(hideTooltipId);
        hideTooltipId = setTimeout(() => hover_TimeBank.classList.add("d-none"), 50);
    };

    const minibar_TimeBank = document.getElementById("minibar-TimeBank");
    minibar_TimeBank.addEventListener("mouseover", mouseOver);
    minibar_TimeBank.addEventListener("mouseleave", mouseLeave);
    if (settings.section("Where to show button").get("show-mini-bar") == false) {
        minibar_TimeBank.classList.add("d-none");
    }

    hover_TimeBank.addEventListener("mouseover", mouseOver);
    hover_TimeBank.addEventListener("mouseleave", mouseLeave);
    hover_TimeBank.appendChild(buttonContainer);
}

function createHeaderTimeDisplay(props) {
    return {
        $template: "#time-bank-display",
        timeAsString: props.text,
        click() {
            let menu = document.getElementById("time-bank-menu");
            // Invert menu display
            menu.style.display = menu.style.display == "none" ? "block" : "none";
            if (DEBUG) {
                ctx.characterStorage.setItem("offline_time", getPlayerTime() + Math.floor(Math.random() * msPerHour * 96)); // Give a (0-4) days worth of time on press.
                updateTimeDisplays();
            }
        },
    };
}

function createTimeBankDisplay(props) {
    return {
        $template: "#time-bank-menu",
    };
}

function createTimeBankButtonArray() {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "grid";
    buttonContainer.style.gridTemplateColumns = "repeat(4,1fr)";
    function addButtons(type, arr) {
        for (const time of arr) {
            const button = document.createElement("button");
            button.className = "btn btn-lg btn-alt-info text-white";
            button.style.backgroundColor = "black";
            button.textContent = time + type;
            button.style.display = "grid";
            button.style.margin = "5px";
            button.style.justifyContent = "center";
            const minOrHour = type === "m" ? minute : hour;
            // If this is the "Spend X time" button
            if (time === "X") {
                button.addEventListener("click", () => onClickSpendX(type));
            } else {
                // This is a normal numbered button
                button.addEventListener("click", () => {
                    simulateTime(time * minOrHour);
                });
            }
            buttonContainer.appendChild(button);
        }
    }
    addButtons("m", minuteArray);
    addButtons("h", hourArray);
    return buttonContainer;
}

function createSettings() {
    settings = ctx.settings;

    settings.section("Where to show button").add({
        type: "switch",
        name: "show-header",
        label: "Show in skill header",
        hint: "",
        default: true,
        onChange: (newValue, oldValue) => {
            if (newValue) {
                document.getElementById("time-bank-display-panel").classList.remove("d-none");
                document.getElementById("time-bank-display-panel").classList.add("d-inline-block");
            } else {
                document.getElementById("time-bank-display-panel").classList.remove("d-inline-block");
                document.getElementById("time-bank-display-panel").classList.add("d-none");
            }
        },
    });

    settings.section("Where to show button").add({
        type: "switch",
        name: "show-mini-bar",
        label: "Show in skill minibar",
        hint: "",
        default: true,
        onChange: (newValue, oldValue) => {
            if (newValue) {
                document.getElementById("minibar-TimeBank").classList.remove("d-none");
            } else {
                document.getElementById("minibar-TimeBank").classList.add("d-none");
            }
        },
    });

    settings.section("Where to show button").add({
        type: "switch",
        name: "show-sidebar",
        label: "Show in sidebar",
        hint: "",
        default: false,
        onChange: (newValue, oldValue) => {
            if (newValue) {
                sidebar.category("").item("time-bank-sidebar", { rootClass: null });
            } else {
                sidebar.category("").item("time-bank-sidebar", { rootClass: "d-none" });
            }
        },
    });

    settings.section("Offline Time Multiplier").add({
        type: "number",
        name: "offline-time-multiplier",
        label: "Since time skipping is 100% efficient with next to nothing wasted, it may be more realistic to only get some fraction of offline time since it is now more valuable than normal.",
        hint: "[0.1 - 10] (ex: 0.8 = 80%)",
        default: 0.8,
        min: 0.1,
        max: 10,
        onChange: (value, previousValue) => {
            try {
                // This whole thing may be unnecessary
                let multiplier = parseFloat(value).toFixed(2);
                multiplier = Math.round((multiplier + Number.EPSILON) * 100) / 100;
                if (multiplier < 0.1 || multiplier > 10) {
                    displayTimeBankToast(`"${multiplier}" is not a valid time multiplier [Min = 0.1, Max = 10]`, "danger");
                    return false;
                }
                return true;
            } catch {
                displayTimeBankToast(`"${value}" is not a valid number [Min = 0.1, Max = 10]`, "danger");
            }
        },
    });

    settings.section("Maximum Offline Time").add({
        type: "number",
        name: "max-offline-time",
        label: "Maximum number of offline hours that can accumulate. (Multiplier applied after max time is calculated)",
        hint: "[Base game is 24hrs, -1 = infinite]",
        default: -1,
        min: -1,
    });

    // Slider
    const numberName = "TimeBankRangeNumberInput";
    const sliderName = "TimeBankRangeSliderInput";

    settings.type("slider", {
        render: renderOfflineRatioSettingsSlider,
        get: (root) => {
            return root.querySelector("#" + sliderName).value;
        },
        set: (root, value) => {
            root.querySelector("#" + sliderName).value = value;
            root.querySelector("#" + numberName).value = value;
        },
    });

    settings.section("Offline Time Ratio").add({
        type: "slider",
        name: "offlineTimeRatioSlider",
        default: 100,
        numberName: numberName,
        sliderName: sliderName,
    });

    settings.section("Xm/Xh Defaults").add([
        {
            type: "number",
            name: "x-m-default",
            label: "Xm default value",
            hint: "Xm button will use this value instead of prompting. Leave blank to prompt",
            min: 1,
        },
        {
            type: "number",
            name: "x-h-default",
            label: "Xh default value",
            hint: "Xh button will use this value instead of prompting. Leave blank to prompt",
            min: 1,
        },
    ]);

    settings.section("Uncap Offline Time Spent").add([
        {
            type: "switch",
            name: "uncap-offline",
            label: "Uncap Offline Time Spent",
            hint: "Vanilla max offline time is 24hrs. Only use this if you are sure you can afk for more than 24hrs (such as having the mod 'Unlimited Offline' installed)",
            default: false,
        }
    ]);

    console.log("Settings Created");
}

// I think I am gonna ignore all params, but want the signature to match the docs
// Someday I dream of this: https://codepen.io/vsync/pen/mdEJMLv
function renderOfflineRatioSettingsSlider(name, onChange, config) {
    let value;
    try {
        value = parseInt(settings.section("Offline Time Ratio").get("offlineTimeRatioSlider"));
    } catch {
        value = config.default;
    }

    console.log("Render get ratio " + value);

    // Typing Input
    const numberInput = document.createElement("input");
    numberInput.id = config.numberName;
    numberInput.type = "number";
    numberInput.value = value;
    numberInput.className = "form-control form-control-lg";

    const labelBase = document.createElement("label");
    labelBase.for = config.numberName;
    labelBase.textContent = "Percent of time banked for later instead:";

    if (config.hint) {
        const hint = document.createElement("small");
        hint.textContent = config.hint;
        labelBase.appendChild(hint);
    }

    // Slider Input
    const sliderRowDiv = document.createElement("div");
    sliderRowDiv.className = "TimeBankRangeRow";

    const labelRangeBase = document.createElement("label");
    labelRangeBase.textContent = "Base";
    labelRangeBase.id = "TimeBankRangeRowEdge";

    const sliderInput = document.createElement("input");
    sliderInput.id = config.sliderName;
    sliderInput.type = "range";
    sliderInput.min = 0;
    sliderInput.max = 100;
    sliderInput.value = value;
    sliderInput.className = "slider";
    sliderInput.classList.add("TimeBankRangeRowSlider");
    sliderInput.style.padding = 25;

    const labelRangeModded = document.createElement("label");
    labelRangeModded.textContent = "Banked";
    labelRangeModded.id = "TimeBankRangeRowEdge";

    sliderRowDiv.append(...[labelRangeBase, sliderInput, labelRangeModded]);

    function numberOnChange() {
        let value = document.getElementById(config.numberName).value;
        value = Math.min(Math.max(value, 0), 100);
        document.getElementById(config.sliderName).value = value;
        document.getElementById(config.numberName).value = value;
    }

    function sliderOnChange() {
        let value = document.getElementById(config.sliderName).value;
        value = Math.min(Math.max(value, 0), 100);
        document.getElementById(config.sliderName).value = value;
        document.getElementById(config.numberName).value = value;
    }

    numberInput.addEventListener("change", numberOnChange);
    numberInput.addEventListener("change", onChange);
    sliderInput.addEventListener("change", sliderOnChange);
    sliderInput.addEventListener("change", onChange);

    const root = document.createElement("div");
    root.append(...[labelBase, numberInput, sliderRowDiv]);
    root.name = name;
    root.id = name;
    return root;
}

// FUNCTIONALITY

function onClickSpendX(type) {
    var time = settings.section("Xm/Xh Defaults").get("x-" + type + "-default");
    if (isNaN(time) || time <= 0) time = parseFloat(prompt("Please input how much time to use"), 0);
    if (!isNaN(time) && time > 0) {
        if (type === "m") {
            simulateTime(time * minute);
        } else if (type === "h") {
            simulateTime(time);
        }
    }
}

function simulateTime(hours) {
    // Stop a time skip if no action is in progress
    if (game.activeAction === undefined) {
        displayTimeBankToast(`No active action, won't skip time while not training`, "danger");
        return;
    }
    // Validate that hours is a positive number
    if (isNaN(hours) | (hours <= 0)) {
        displayTimeBankToast(`Cannot spend time: "${hours}", time must be a positive number`, "danger");
        return;
    }
    // Compute if sufficient time is available
    let timeToSimulate = hours * msPerHour;
    let player_offline_time = getPlayerTime();
    if (player_offline_time <= 0) {
        displayTimeBankToast("No banked time available.", "danger");
        return;
    }
    if (player_offline_time < timeToSimulate) {
        // Not Enough Time
        timeToSimulate = player_offline_time;
        hours = timeToSimulate / msPerHour;
        displayTimeBankToast(`Not enough time. Skipping ${formatTimeForDisplay(timeToSimulate)}.`, "info");
    }
    if (hours > 24 & settings.section("Uncap Offline Time Spent").get("uncap-offline") == false) {
        // Too much time, vanilla cannot simulate more than 24hrs at a time
        hours = 24;
        timeToSimulate = hours * msPerHour;
        displayTimeBankToast(`Time spent has been capped. Too much time to simulate. Skipping ${formatTimeForDisplay(timeToSimulate)}.`, "info");
    }
    // Hide UI if it is visible
    if (swal.isVisible()) swal.close();
    document.getElementById("time-bank-menu").style.display = "none";
    // Preform time skip and subtract used time
    game.testForOffline(hours);
    ctx.characterStorage.setItem("offline_time", Math.max(player_offline_time - timeToSimulate, 0));
    if (DEBUG) console.log(`Successfully spent ${timeToSimulate} time [${player_offline_time} -> ${getPlayerTime()}]`);
    // Update button text and minibar text to display new correct time
    updateTimeDisplays();
}

function interceptOfflineProgress() {
    ctx.patch(Game, "enterOfflineLoop").replace((originalMethod, loopTime, isModCall) => {
        if (!isModCall) {
            // Intercept offline time
            let newTime = loopTime - game.tickTimestamp;

            // If enough time has not passed its likely the game itself is trying to force an offline process, let that happen since there is no tangable time to "bank"
            if (newTime < game.MIN_OFFLINE_TIME) {
                return originalMethod(loopTime);
            }
            
            if (settings.section("Maximum Offline Time").get("max-offline-time") > 0) {
                // cap offline time if set
                newTime = Math.min(newTime, settings.section("Maximum Offline Time").get("max-offline-time") * msPerHour);
            }
            newTime *= settings.section("Offline Time Multiplier").get("offline-time-multiplier");
            // Split offline time into two behaviors
            // baseOfflineTime - Behaves just like the base game giving progress
            // offlineTimeBank - Saves the time into the bank instead and gives no progress
            let timeRatio = parseInt(settings.section("Offline Time Ratio").get("offlineTimeRatioSlider")) / 100;
            let offlineTimeBank = newTime * timeRatio;
            let baseOfflineTime = newTime - offlineTimeBank;

            // Reset the last tick to now so that Melvor doesn't think we were offline.
            game.tickTimestamp = Date.now();
            // Let the game know we processed the offline loop for it.
            game._forceOfflineLoop = false;
            // Bank all time
            depositTimeInMs(newTime);

            // Then spend some of it as normal if Offline Time Ratio > 1
            if (baseOfflineTime > TICK_INTERVAL) {
                simulateTime(baseOfflineTime / msPerHour);
            }
            if (offlineTimeBank > TICK_INTERVAL) {
                displayTimeBankToast(`Away for ${formatTimeForDisplay(offlineTimeBank)}, time recorded`, "success");
                updateTimeDisplays();
            }

            return new Promise((resolve) => {
                return resolve();
            });
        } else {
            return originalMethod(loopTime);
        }
    });

    // Help processOffline differentiate between time skip call and offline progress call.
    ctx.patch(Game, "testForOffline").replace((originalMethod, timeToGoBack) => {
        // Everything from the original testForOffline().
        return __awaiter(game, void 0, void 0, function* () {
            game.stopMainLoop();
            game.tickTimestamp -= timeToGoBack * msPerHour;
            game.skills.forEach((skill)=>
                {
                    skill.timeToLevelTracker.clear();
                    skill.timeToLevelTicks = 0;
                    skill.timeToLevelPercentStart = skill.nextAbyssalLevelProgress;
                }
            );
            saveData();

            // Trigger the game to enter an offline loop on its own so that we don't need to do additional logic.
            yield game.enterOfflineLoop(Date.now(), true);

            // Allow the game to re-enter its normal loop state, which now includes processing offline time
            game.startMainLoop();
        });
    });
}

function depositTimeInMs(ms) {
    if (isNaN(ms)) {
        return `cannot deposit time, "${ms}" is not a number`;
    }
    // Math.max so time can't go negative since negative inputs are allowed
    ctx.characterStorage.setItem("offline_time", Math.max(getPlayerTime() + ms, 0));
    updateTimeDisplays();
}

function depositTimeInHours(hours) {
    depositTimeInMs(hours * msPerHour);
}

function formatTimeForDisplay(time) {
    if (!time) {
        return "00h 00m";
    }
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
    let time = Number(ctx.characterStorage.getItem("offline_time"));
    //return Math.max(time, ~~time)
    return ~~time ? time : 0; // converts `time` twice resulting in 0 if it was undefined or NaN
}

function displayTimeBankToast(message, badge = "info", duration = 5000) {
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
            <img class="notification-img" src=${logo}>
            <span class="badge badge-${badge}">${message}</span>
        </div>`,
        duration
    );
}
