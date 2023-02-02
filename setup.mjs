let ctx;
let settings;
const DEBUG = false;
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
        document.getElementById("offlineTimeBankSmall2").innerText = "\nTime: " + formattedTimeString;
    } catch {}
}

function patchMinibar() {
    ctx.patch(Minibar, "initialize").after(() => {
        game.minibar.minibarElement.prepend(
            game.minibar.createMinibarItem("minibar-TimeBank", `${CDNDIR}assets/media/skills/astrology/arachi.svg`, "", {
                onClick: () => document.getElementById("hover-TimeBank").classList.remove("d-none"),
            }).element
        );
    });
}

function additionalMinibarPatches() {
    // Welcome to my spaghetti code. Don't bother trying to understand.
    const hover_TimeBank = document.getElementById("skill-footer-minibar-items-container").cloneNode();
    hover_TimeBank.id = "hover-TimeBank";
    hover_TimeBank.classList.add("d-none");
    hover_TimeBank.style.minWidth = "200px";
    document.getElementById("skill-footer-minibar-items-container").parentElement.appendChild(hover_TimeBank);
    const span = hover_TimeBank.appendChild(document.createElement("span"));
    span.className = "font-size-sm text-center text-white";
    const small = span.appendChild(document.createElement("small"));
    small.textContent = "Time Bank";
    const small2 = small.appendChild(document.createElement("small"));
    small2.id = "offlineTimeBankSmall2";
    small2.innerText = "\nTime: " + formatTimeForDisplay(getPlayerTime());
    const buttonContainer = createTimeBankButtonArray();
    buttonContainer.style.gridTemplateColumns = "repeat(2,1fr)";
    const minibar_TimeBank = document.getElementById("minibar-TimeBank");
    minibar_TimeBank.addEventListener("mouseover", () => hover_TimeBank.classList.remove("d-none"));
    minibar_TimeBank.addEventListener("mouseleave", () => hover_TimeBank.classList.add("d-none"));
    if (settings.section("Time skip menu in skill minibar").get("show-mini-bar") == false) {
        minibar_TimeBank.classList.add("d-none");
    }
    hover_TimeBank.addEventListener("mouseover", () => hover_TimeBank.classList.remove("d-none"));
    hover_TimeBank.addEventListener("mouseleave", () => hover_TimeBank.classList.add("d-none"));
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
                document.getElementById("minibar-TimeBank").classList.remove("d-none");
            } else {
                document.getElementById("minibar-TimeBank").classList.add("d-none");
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
        default: 24,
        min: -1,
    });

    // Slider
    const numberName = "TimeBankRangeNumberInput";
    const sliderName = "TimeBankRangeSliderInput";

    settings.type("slider", {
        render: renderOfflineRatioSettingsSlider,
        get: (root) => {
            try {
                return root.querySelector(sliderName).value;
            } catch {}
        },
        set: (root, value) => {
            try {
                root.querySelector(numberName).value = value;
                root.querySelector(sliderName).value = value;
            } catch {}
        },
    });

    settings.section("Offline Time Ratio").add({
        type: "slider",
        name: "offlineTimeRatioSlider",
        default: 100,
        numberName: numberName,
        sliderName: sliderName,
    });
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

    // Typing Input
    const numberInput = document.createElement("input");
    numberInput.id = config.numberName;
    numberInput.type = "number";
    numberInput.name = config.numberName;
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
    sliderInput.addEventListener("change", sliderOnChange);

    const root = document.createElement("div");
    root.append(...[labelBase, numberInput, sliderRowDiv]);
    return root;
}

// FUNCTIONALITY

function simulateTime(hours) {
    // Stop a time skip if no action is in progress
    if (game.activeAction === undefined) {
        displayTimeBankToast(`No active action, won't skip time while not training`, "danger");
        return;
    }
    // Compute if sufficient time is available
    let timeToSimulate = hours * msPerHour;
    let player_offline_time = getPlayerTime();
    if (player_offline_time < timeToSimulate && DEBUG == false) {
        displayTimeBankToast("Insufficient time available to skip that much time.", "danger");
        return;
    }
    // Hide UI if it is visible
    if (swal.isVisible()) swal.close();
    document.getElementById("time-bank-menu").style.display = "none";
    // Preform time skip and subtract used time
    game.testForOffline(hours);
    game.township.availableGameTicksToSpend += Math.floor((hours * 60) / (game.township.TICK_LENGTH / 60));
    game.township.renderQueue.ticksAvailable = true;
    ctx.characterStorage.setItem("offline_time", Math.max(player_offline_time - timeToSimulate, 0));
    if (DEBUG) console.log(`Successfully spent ${timeToSimulate} time [${player_offline_time} -> ${getPlayerTime()}]`);
    // Update button text and minibar text to display new correct time
    updateTimeDisplays();
}

function interceptOfflineProgress() {
    ctx.patch(Game, "processOffline").replace((originalMethod, isModCall) => {
        if (!isModCall) {
            // Intercept offline time
            let newTime = Date.now() - game.tickTimestamp;
            if (settings.section("Maximum Offline Time").get("max-offline-time") > 0) {
                // cap offline time if set
                newTime = Math.min(newTime, settings.section("Maximum Offline Time").get("max-offline-time") * msPerHour);
            }
            newTime *= settings.section("Offline Time Multiplier").get("offline-time-multiplier");
            if (DEBUG) newTime += msPerHour * 20 * Math.random();
            // Split offline time into two behaviors
            // baseOfflineTime - Behaves just like the base game giving progress
            // offlineTimeBank - Saves the time into the bank instead and gives no progress
            let timeRatio = parseInt(settings.section("Offline Time Ratio").get("offlineTimeRatioSlider")) / 100;
            let offlineTimeBank = newTime * timeRatio;
            let baseOfflineTime = newTime - offlineTimeBank;
            // Reset 'last seen' to now
            // TODO: Not sure if even needed...
            game.tickTimestamp = Date.now();
            // Bank all time
            ctx.characterStorage.setItem("offline_time", getPlayerTime() + newTime);
            // Then spend some of it as normal if Offline Time Ratio > 1
            if (baseOfflineTime > TICK_INTERVAL) {
                simulateTime(baseOfflineTime / msPerHour);
            }
            if (offlineTimeBank > TICK_INTERVAL) {
                displayTimeBankToast(`Away for ${formatTimeForDisplay(offlineTimeBank)}, time recorded`, "success");
                updateTimeDisplays();
            }
        } else {
            originalMethod();
        }
    });

    // Help processOffline differentiate between time skip call and offline progress call.
    ctx.patch(Game, "testForOffline").replace((originalMethod, hours) => {
        // Everything from the original testForOffline().
        return __awaiter(game, void 0, void 0, function* () {
            game.stopMainLoop();
            game.tickTimestamp -= hours * msPerHour;
            saveData("all");
            // Except that processOffline() is passed true.
            yield game.processOffline(true);
            game.startMainLoop();
        });
    });
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
    return Number(ctx.characterStorage.getItem("offline_time"));
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
            <img class="notification-img" src="https://cdn.melvor.net/core/v018/assets/media/skills/astrology/arachi.svg">
            <span class="badge badge-${badge}">${message}</span>
        </div>`,
        duration
    );
}
