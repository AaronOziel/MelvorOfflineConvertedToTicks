const DEBUG = true;

export async function modifySettings({ settings, characterStorage }) {
    settings.section('Startup').add(
    {
        name: 'startup',
        type: 'radio-group',
        label: 'Enable or disable startup prompts.',
        hint: 'A prompt at startup asking whether you\'d like to store the offline time or have it operate normally.',
        options: 
        [
            {
                value: 'store',
                label: "Always store offline time",
            },
            {
                value: 'vanilla',
                label: "Never store offline time",
            },
            {
                value: 'ask',
                label: "Always ask",
            },  
        ],
        default: characterStorage.getItem('startup') ? 
                    characterStorage.getItem('startup') :
                    'store',
        onChange: (newValue, prevValue) => {
            characterStorage.setItem('startup', newValue);

            if (DEBUG) {
                console.log(`SettingsVal(startup): ${settings.section('startup').value}`)
                console.log(`CharStore(startup): ${characterStorage.getItem('startup')}`)
            }
        }, 
    }); 
}

export async function startupBehavior({ settings }) {
    const behavior = settings.section('Startup').value;
    
    switch(behavior){
        case 'store': // Do nothing. Let the mod do what it was gonna do in the first place.
            break;
        case 'vanilla': // Make sure interceptOffline() isn't called. We'll passing this back to setup.mjs to interact with the function.
            break;
        case 'ask': // Create window with the above two as options.
            new Swal;
            setTimeout(()=>{
                // Remove the initial button.

                // Add two buttons of your own.

                // Functionality of store button.

                // Functionality of vanilla button.

            }, 35);
            break;
        default:
            console.error(`startupBehavior() handling unexpected value: ${behavior}`);
    }

    return behavior;
}