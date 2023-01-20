let ctx;
let debug = true;

export async function setup(gameContext) {
    ctx = gameContext
    ctx.onCharacterSelectionLoaded(() => {
        patchMinibar(); // Minibar icon.
    });

    ctx.onCharacterLoaded(() => {
        //uncapOfflineTime();
        interceptOfflineProgress();
        //initializeConfigs();
    });

    ctx.onInterfaceReady(() => {
        createSettings(); // Settings buttons.
        additionalMinibarPatches(); // Minibar time buttons.
        ui.create(displayTicksInHeader({ text: formatTicksForDisplay(getPlayerTicks()) }),
            document.getElementById('header-theme').getElementsByClassName('d-flex align-items-right')[0]);
    });
}

const hour = 1;
const hourArray = [1, 2, 4, 8, 16];
const minute = hour / 60;
const minuteArray = [5, 15, 30];

function simulateTime(hours) {
    // Compute if sufficient ticks are available 
    let ticksToSimulate = (hours / minute) * (1000 / TICK_INTERVAL);
    let player_offline_ticks = getPlayerTicks();
    player_offline_ticks *= debug ? 10 : 1; // if in debug, multiply ticks by 10
    if (player_offline_ticks < ticksToSimulate) {
        console.error("Error: Insufficient Ticks " + player_offline_ticks + " < " + ticksToSimulate)
        return; // TODO: Add error reporting somehow
    }
    // Hide UI if it is visible
    if (swal.isVisible()) { swal.close(); }
    // Preform time skip and subtract used ticks
    game.testForOffline(hours);
    game.township.availableGameTicksToSpend += Math.floor((hours * 60) / (game.township.TICK_LENGTH / 60));
    game.township.renderQueue.ticksAvailable = true;
    ctx.characterStorage.setItem('offline_ticks', player_offline_ticks - ticksToSimulate)
    console.log("Successfully spent " + ticksToSimulate + " ticks "
        + "[" + player_offline_ticks + "->" + getPlayerTicks() + "]")
    // Update button text to display new correct time
    document.getElementById("time-skip-display-button").textContent = formatTicksForDisplay(getPlayerTicks());
}


function patchMinibar() {
    ctx.patch(Minibar, 'initialize').after(() => {
        game.minibar.minibarElement.prepend(
            game.minibar.createMinibarItem('minibar-timeSkip',
                `${CDNDIR}assets/media/skills/astrology/arachi.svg`,
                '',
                { onClick: () => document.getElementById('hover-timeSkip').classList.remove('d-none') },
            ).element
        )
    })
}


function additionalMinibarPatches() {
    // Welcome to my spaghetti code. Don't bother trying to understand.
    const hover_timeSkip = document.getElementById('skill-footer-minibar-items-container').cloneNode();
    hover_timeSkip.id = 'hover-timeSkip';
    hover_timeSkip.classList.add('d-none');
    const span = hover_timeSkip.appendChild(document.createElement('span'));
    span.className = 'font-size-sm text-center text-white';
    const small = span.appendChild(document.createElement('small'));
    small.textContent = 'Time Skip';
    const buttonContainer = hover_timeSkip.appendChild(document.createElement('div'));
    document.getElementById('skill-footer-minibar-items-container').parentElement.appendChild(hover_timeSkip);
    buttonContainer.style.display = 'grid';
    buttonContainer.style.gridTemplateColumns = 'repeat(2,1fr)';
    const minibar_timeSkip = document.getElementById('minibar-timeSkip');
    minibar_timeSkip.addEventListener('mouseover', () => hover_timeSkip.classList.remove('d-none'));
    hover_timeSkip.addEventListener('mouseover', () => hover_timeSkip.classList.remove('d-none'));
    minibar_timeSkip.addEventListener('mouseleave', () => hover_timeSkip.classList.add('d-none'));
    hover_timeSkip.addEventListener('mouseleave', () => hover_timeSkip.classList.add('d-none'));

    function addButtons(type, arr) {
        for (const time of arr) {
            const button = document.createElement('button');
            button.className = 'btn btn-sm btn-outline-secondary overlay-container overlay-bottom skill-icon-sm font-w700 font-size-xs mb-0 text-white';
            button.style.backgroundColor = 'black';
            button.textContent = time + type;
            button.style.display = 'grid';
            button.style.justifyContent = 'center';
            const minOrHour = (type === 'm') ? minute : hour;
            button.addEventListener('click', () => { simulateTime(time * minOrHour) });
            buttonContainer.appendChild(button);
        }
    }
    addButtons('m', minuteArray);
    addButtons('h', hourArray);
}


function createSettings() {
    const buttonArray = [];

    function addButtons(type, arr) {
        for (const time of arr) {
            let timeStr;
            let minOrHour;

            if (type === 'm') {
                timeStr = 'Min'
                minOrHour = minute;
            } else {
                timeStr = 'Hrs'
                minOrHour = hour;
            }

            buttonArray.push({
                type: 'button',
                name: `buttonMinute${time}`,
                display: time + ' ' + timeStr,
                onClick: () => {
                    simulateTime(time * minOrHour);
                }
            });
        }
    }
    addButtons('m', minuteArray);
    addButtons('h', hourArray);
    ctx.settings.section('Skip').add(buttonArray);
}

function interceptOfflineProgress() {
    ctx.patch(Game, 'processOffline').replace((originalMethod, isModCall) => {
        console.log(`Process offline: ${isModCall}`);
        if (!isModCall) { // Intercept offline time and replace with ticks
            // Modify standard tick length of 50ms based on settings
            //const offline_multiplier = parseFloat(ctx.settings.section('Other').get('offline_multiplier'))
            const MODIFIED_TICK_LENGTH = TICK_INTERVAL * 1.0; //offline_multiplier;
            // Add new ticks to the total
            let newTicks = (Date.now() - game.tickTimestamp) / MODIFIED_TICK_LENGTH;
            ctx.characterStorage.setItem('offline_ticks', getPlayerTicks() + newTicks)
            // Reset 'last seen' to now
            game.tickTimestamp = Date.now();
            console.log("Offline progress intercepted....")
        } else {
            console.log("Calling original offline")
            originalMethod();
        }
    });

    // Help processOffline differentiate between time skip call and offline progress call.
    ctx.patch(Game, 'testForOffline').replace((originalMethod, timeToGoBack) => {
        // Everything from the original testForOffline().
        return __awaiter(game, void 0, void 0, function* () {
            game.stopMainLoop();
            console.log("Going back in time - " + timeToGoBack)
            game.tickTimestamp -= timeToGoBack * 60 * 60 * 1000;
            saveData('all');
            // Except that processOffline() is passed true.
            yield game.processOffline(true);
            game.startMainLoop();
        });
    });
}

function formatTicksForDisplay(ticks) {
    // Calculate totals
    const milliseconds = ticks * 50;
    const totalSeconds = parseInt(Math.floor(milliseconds / 1000));
    const totalMinutes = parseInt(Math.floor(totalSeconds / 60));
    const totalHours = parseInt(Math.floor(totalMinutes / 60));
    const days = parseInt(Math.floor(totalHours / 24));
    // Add leading 0s if necessary
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    const hours = (totalHours % 24).toString().padStart(2, '0');
    // Time is `hh mm` by default, add `dd` if hours > 24
    let time = `${hours}h ${minutes}m`;
    if (days > 0)
        time = `${days}d ` + time;
    return time;
}

function displayTicksInHeader(props) {
    return {
        $template: '#time-skip-display',
        ticksAsString: props.text,
        click() {
            simulateTime(0.8);
        }
    };
}

function getPlayerTicks() {
    let ticks = parseInt(ctx.characterStorage.getItem('offline_ticks'));
    return (ticks === undefined || isNaN(ticks)) ? 0 : ticks
}

function initializeConfigs() {

}