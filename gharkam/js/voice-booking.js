// =========================================================
// Gharmitra AI Voice Booking Assistant (मराठी / हिंदी / English)
// =========================================================

(function () {
    let recognition = null;
    let isListening = false;
    let shouldBeListening = false;
    let currentLanguage = 'mr-IN'; // Default to Marathi
    let finalTranscript = '';
    let restartTimer = null;
    let detectedData = {
        service: null,
        area: null,
        budget: null,
        issue: ''
    };

    // Service Keyword Dictionaries
    const SERVICE_KEYWORDS = [
        {
            service: 'Plumbing',
            icon: '🪠',
            nameMr: 'प्लंबर (Plumbing)',
            keywords: [
                'नळ', 'पाणी', 'पाईप', 'लिकेज', 'बेसिन', 'गळतोय', 'गळत', 'गळती', 'प्लंबर', 'टॉयलेट', 
                'फ्लश', 'वॉशबेसिन', 'कमोड', 'सिंक', 'तुंबले', 'तुंबला', 'ड्रेन', 'कॉकरोच जाळी',
                'tap', 'pipe', 'leak', 'leakage', 'basin', 'plumber', 'water', 'sink', 'drain', 
                'blockage', 'flush', 'commode', 'fitting', 'sanitary'
            ],
            defaultBudget: 299
        },
        {
            service: 'Electrician',
            icon: '⚡',
            nameMr: 'इलेक्ट्रिशियन (Electrician)',
            keywords: [
                'फॅन', 'पंखा', 'लाईट', 'लाइट', 'बल्ब', 'वायर', 'वायरिंग', 'शॉर्ट सर्किट', 'स्विच', 
                'बोर्ड', 'फ्युज', 'गिझर', 'ट्यूबलाइट', 'कुलर', 'इलेक्ट्रिशियन', 'इलेक्ट्रिक', 'करंट',
                'electrician', 'fan', 'light', 'switch', 'short circuit', 'fuse', 'wiring', 'mcb', 
                'geyser', 'cooler', 'current', 'power', 'socket'
            ],
            defaultBudget: 249
        },
        {
            service: 'Carpenter',
            icon: '🪚',
            nameMr: 'सुतार (Carpenter)',
            keywords: [
                'सुतार', 'लाकूड', 'दरवाजा', 'खिडकी', 'कपाट', 'टेबल', 'खुर्ची', 'बेड', 'फर्निचर', 
                'कारपेंटर', 'हँडल', 'हिंज', 'लाकडी', 'फर्निचर रिपेअर',
                'carpenter', 'wood', 'door', 'window', 'cupboard', 'table', 'chair', 'furniture', 
                'bed', 'sofa', 'hinge', 'handle', 'drawer'
            ],
            defaultBudget: 349
        },
        {
            service: 'Cleaning',
            icon: '🧹',
            nameMr: 'साफसफाई (Cleaning)',
            keywords: [
                'साफसफाई', 'स्वच्छता', 'झाडू', 'लादी', 'पुसणे', 'डीप क्लिनिंग', 'साफ', 'घरकाम', 
                'झाडलोट', 'बाथरुम क्लिनिंग', 'स्वयंपाकघर साफ', 'मदतनीस', 'कामवाली',
                'cleaning', 'clean', 'sweep', 'mop', 'deep cleaning', 'maid', 'wash', 'bathroom clean', 
                'kitchen clean', 'sofa clean'
            ],
            defaultBudget: 499
        },
        {
            service: 'Painting',
            icon: '🎨',
            nameMr: 'पेंटर (Painting)',
            keywords: [
                'रंग', 'भिंत', 'पुट्टी', 'डिस्टेंपर', 'पेंटर', 'कलर', 'रंगकाम', 'कलरिंग', 'वॉटरप्रूफिंग',
                'paint', 'painting', 'painter', 'color', 'whitewash', 'wall paint', 'putty'
            ],
            defaultBudget: 899
        },
        {
            service: 'AC Repair',
            icon: '❄️',
            nameMr: 'एसी दुरुस्ती (AC Repair)',
            keywords: [
                'एसी', 'एअर कंडिशनर', 'कुलिंग', 'गॅस भरणे', 'गॅस लिकेज', 'एसी सर्व्हिसिंग',
                'ac', 'air conditioner', 'cooling', 'ac repair', 'split ac', 'window ac', 'ac service'
            ],
            defaultBudget: 499
        },
        {
            service: 'Appliance Repair',
            icon: '🔌',
            nameMr: 'घरगुती उपकरणे (Appliances)',
            keywords: [
                'फ्रीज', 'रेफ्रिजरेटर', 'वॉशिंग मशीन', 'मायक्रोवेव्ह', 'मिक्सर', 'ओव्हन', 'उपकरण',
                'appliance', 'fridge', 'refrigerator', 'washing machine', 'mixer', 'microwave', 'oven'
            ],
            defaultBudget: 399
        },
        {
            service: 'Masonry',
            icon: '🧱',
            nameMr: 'गवंडी / बांधकाम (Masonry)',
            keywords: [
                'बांधकाम', 'सिमेंट', 'गिलावा', 'टाइल्स', 'विटा', 'गवंडी', 'भिंत दुरुस्ती', 'फरशी',
                'mason', 'masonry', 'tile', 'tiles', 'cement', 'plaster', 'brick', 'flooring'
            ],
            defaultBudget: 599
        },
        {
            service: 'Locksmith',
            icon: '🔑',
            nameMr: 'चावी / कुलूप (Locksmith)',
            keywords: [
                'चावी', 'कुलूप', 'लॉक', 'दार अडकले', 'किल्ली', 'डुप्लिकेट चावी', 'लॉक रिपेअर',
                'lock', 'key', 'locksmith', 'door locked', 'chavi', 'duplicate key'
            ],
            defaultBudget: 249
        },
        {
            service: 'Pest Control',
            icon: '🦟',
            nameMr: 'पेस्ट कंट्रोल (Pest Control)',
            keywords: [
                'झुरळे', 'ढेकूण', 'मुंग्या', 'डास', 'वाळवी', 'उंदीर', 'किडे', 'पेस्ट कंट्रोल',
                'pest', 'cockroach', 'termite', 'bedbugs', 'ants', 'mosquito', 'pest control', 'insects'
            ],
            defaultBudget: 699
        },
        {
            service: 'Gardening',
            icon: '🌿',
            nameMr: 'माळी / बागकाम (Gardening)',
            keywords: [
                'बाग', 'झाडे', 'माती', 'रोपे', 'पाणी घालणे', 'गवत', 'माळी', 'बागकाम', 'कुंड्या',
                'garden', 'gardener', 'plants', 'lawn', 'pruning', 'soil', 'pots'
            ],
            defaultBudget: 349
        },
        {
            service: 'Glass & Aluminium',
            icon: '🪟',
            nameMr: 'काच व ॲल्युमिनियम (Glass)',
            keywords: [
                'काच', 'खिडकी', 'ॲल्युमिनियम', 'सरकती खिडकी', 'स्लाइडिंग', 'काच फुटली',
                'glass', 'aluminium', 'sliding', 'window glass', 'sliding door', 'mirror'
            ],
            defaultBudget: 399
        },
        {
            service: 'TV & DTH',
            icon: '📺',
            nameMr: 'टीव्ही व डिश (TV & DTH)',
            keywords: [
                'टीव्ही', 'डिश', 'सेट टॉप बॉक्स', 'केबल', 'टाटा प्ले', 'डिश टीव्ही', 'अँटेना',
                'tv', 'television', 'dth', 'dish tv', 'tata play', 'set top box', 'wall mount'
            ],
            defaultBudget: 299
        },
        {
            service: 'Moving & Shifting',
            icon: '📦',
            nameMr: 'पॅकर्स व शिफ्टिंग (Shifting)',
            keywords: [
                'सामान हलवणे', 'शिफ्टिंग', 'टेम्पो', 'पॅकर्स', 'हलवायचे', 'घर शिफ्ट', 'लगेज',
                'shifting', 'moving', 'packers', 'movers', 'luggage', 'tempo', 'house shifting'
            ],
            defaultBudget: 1199
        },
        {
            service: 'Bathroom Services',
            icon: '🚿',
            nameMr: 'बाथरुम सेवा (Bathroom)',
            keywords: [
                'बाथरुम', 'शॉवर', 'पाश्चात्य कमोड', 'नळ बसवणे', 'टॉयलेट सीट',
                'bathroom', 'shower', 'toilet seat', 'geyser fitting', 'bathroom renovation'
            ],
            defaultBudget: 399
        }
    ];

    // Pune Areas Dictionary
    const AREA_KEYWORDS = [
        { area: 'Kothrud', keywords: ['कोथरूड', 'कोथरुड', 'kothrud', 'karve nagar', 'कर्वे नगर', 'paud road', 'पौड रोड', 'vanaz', 'वनाझ'] },
        { area: 'Swargate', keywords: ['स्वारगेट', 'swargate', 'parvati', 'पर्वती', 'sarasbaug', 'सारसबाग'] },
        { area: 'Baner', keywords: ['बाणेर', 'baner', 'balewadi', 'बालेवाडी', 'sus', 'सुस'] },
        { area: 'Wakad', keywords: ['वाकड', 'wakad', 'dange chowk', 'डांगे चौक', 'thergaon', 'थेरगाव'] },
        { area: 'Hinjawadi', keywords: ['हिंजवडी', 'हिंजेवाडी', 'hinjawadi', 'hinjewadi', 'phase 1', 'phase 2', 'phase 3', 'maan'] },
        { area: 'Hadapsar', keywords: ['हडपसर', 'hadapsar', 'gadital', 'गाडीतळ', 'manjari', 'मांजरी'] },
        { area: 'Magarpatta', keywords: ['मगरपट्टा', 'magarpatta', 'amanora', 'अमानोरा'] },
        { area: 'Viman Nagar', keywords: ['विमान नगर', 'विमाननगर', 'viman nagar', 'airport', 'विमानतळ'] },
        { area: 'Kharadi', keywords: ['खराडी', 'kharadi', 'eon free zone', 'chandan nagar', 'चंदन नगर'] },
        { area: 'Aundh', keywords: ['औंध', 'aundh', 'parihar chowk', 'परिहार चौक', 'spu', 'विद्यापीठ'] },
        { area: 'Shivajinagar', keywords: ['शिवाजीनगर', 'shivajinagar', 'fc road', 'jm road', 'model colony'] },
        { area: 'Katraj', keywords: ['कात्रज', 'katraj', 'ambegaon', 'आंबेगाव', 'bharti vidyapeeth'] },
        { area: 'Koregaon Park', keywords: ['कोरेगाव पार्क', 'koregaon park', 'kp', 'north main road'] },
        { area: 'Kondhwa', keywords: ['कोंढवा', 'kondhwa', 'salunke vihar', 'साळुंखे विहार'] },
        { area: 'NIBM', keywords: ['एनआयबीएम', 'nibm', 'undri', 'उंड्री', 'mohammed wadi'] },
        { area: 'Bibwewadi', keywords: ['बिबवेवाडी', 'bibwewadi', 'market yard', 'मार्केट यार्ड'] },
        { area: 'Dhankawadi', keywords: ['धनकवडी', 'dhankawadi', 'chavan nagar'] },
        { area: 'Pimple Saudagar', keywords: ['पिंपळे सौदागर', 'pimple saudagar', 'pimple gurav', 'पिंपळे गुरव'] },
        { area: 'Pimpri', keywords: ['पिंपरी', 'pimpri', 'nehrunagar', 'नेहरूनगर'] },
        { area: 'Chinchwad', keywords: ['चिंचवड', 'chinchwad', 'chikhali', 'चिखली', 'akurdi', 'आकुर्डी'] },
        { area: 'Yerawada', keywords: ['येरवडा', 'yerawada', 'shastri nagar'] },
        { area: 'Wagholi', keywords: ['वाघोली', 'wagholi', 'bakori'] },
        { area: 'Dhanori', keywords: ['धानोरी', 'dhanori', 'tingre nagar'] },
        { area: 'Lohegaon', keywords: ['लोहगाव', 'लोहेगाव', 'lohegaon'] },
        { area: 'Camp', keywords: ['कॅम्प', 'camp', 'mg road', 'east street', 'लष्कर'] },
        { area: 'Deccan', keywords: ['डेक्कन', 'deccan', 'gymkhana', 'प्रभात रोड', 'prabhat road'] },
        { area: 'Sinhagad Road', keywords: ['सिंहगड रोड', 'सिंहगड', 'sinhagad road', 'dhayari', 'धायरी', 'vadgaon', 'वडगाव', 'narhe', 'नऱ्हे'] },
        { area: 'Warje', keywords: ['वारजे', 'warje', 'malwadi', 'माळवाडी'] },
        { area: 'Bavdhan', keywords: ['बावधन', 'bavdhan', 'chandani chowk', 'चांदणी चौक'] },
        { area: 'Vishrantwadi', keywords: ['विश्रांतवाडी', 'vishrantwadi', 'kalas', 'कळस'] }
    ];

    // Numbers in Marathi word mapping
    const MARATHI_NUMBERS = {
        'शंभर': 100, 'दोनशे': 200, 'तीनशे': 300, 'चारशे': 400, 'पाचशे': 500,
        'सहाशे': 600, 'सातशे': 700, 'आठशे': 800, 'नऊशे': 900, 'हजार': 1000,
        'दीडशे': 150, 'अडीचशे': 250, 'दीड हजार': 1500, 'दोन हजार': 2000
    };

    // --- NLP Intent & Entity Parser ---
    function parseVoiceIntent(rawText) {
        if (!rawText) return;
        const text = rawText.toLowerCase().trim();
        let matchedService = null;
        let matchedArea = null;
        let matchedBudget = null;

        // 1. Detect Service
        for (const item of SERVICE_KEYWORDS) {
            for (const kw of item.keywords) {
                if (text.includes(kw.toLowerCase())) {
                    matchedService = item;
                    break;
                }
            }
            if (matchedService) break;
        }

        // 2. Detect Area in Pune
        for (const item of AREA_KEYWORDS) {
            for (const kw of item.keywords) {
                if (text.includes(kw.toLowerCase())) {
                    matchedArea = item.area;
                    break;
                }
            }
            if (matchedArea) break;
        }

        // 3. Detect Budget
        for (const [word, val] of Object.entries(MARATHI_NUMBERS)) {
            if (text.includes(word)) {
                matchedBudget = val;
                break;
            }
        }
        if (!matchedBudget) {
            const digitMatch = text.match(/(?:₹|rs|रु|रुपये)?\s*([1-9][0-9]{2,4})\s*(?:₹|rs|रु|रुपये)?/i);
            if (digitMatch && digitMatch[1]) {
                const parsed = parseInt(digitMatch[1], 10);
                if (parsed >= 100 && parsed <= 50000) {
                    matchedBudget = parsed;
                }
            }
        }
        if (!matchedBudget && matchedService) {
            matchedBudget = matchedService.defaultBudget;
        }

        detectedData = {
            service: matchedService,
            area: matchedArea,
            budget: matchedBudget,
            issue: rawText
        };

        updateVoicePreviewUI();
    }

    // --- Update Preview Badges in Modal ---
    function updateVoicePreviewUI() {
        const serviceBadge = document.getElementById('voiceDetectedService');
        const areaBadge = document.getElementById('voiceDetectedArea');
        const budgetBadge = document.getElementById('voiceDetectedBudget');
        const applyBtn = document.getElementById('voiceApplyBtn');

        if (serviceBadge) {
            if (detectedData.service) {
                serviceBadge.innerHTML = `<span class="text-base">${detectedData.service.icon}</span> <span>${detectedData.service.nameMr}</span>`;
                serviceBadge.className = 'inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold px-3 py-1.5 rounded-xl';
            } else {
                serviceBadge.innerHTML = '<span>शोधत आहे...</span>';
                serviceBadge.className = 'inline-flex items-center gap-1 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-medium px-3 py-1.5 rounded-xl';
            }
        }

        if (areaBadge) {
            if (detectedData.area) {
                areaBadge.innerHTML = `<span>📍</span> <span>${detectedData.area}</span>`;
                areaBadge.className = 'inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-300 text-xs font-bold px-3 py-1.5 rounded-xl';
            } else {
                areaBadge.innerHTML = '<span>पुण्यातील भाग सांगा...</span>';
                areaBadge.className = 'inline-flex items-center gap-1 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-medium px-3 py-1.5 rounded-xl';
            }
        }

        if (budgetBadge) {
            if (detectedData.budget) {
                budgetBadge.innerHTML = `<span>₹${detectedData.budget}</span>`;
                budgetBadge.className = 'inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-300 text-xs font-bold px-3 py-1.5 rounded-xl';
            } else {
                budgetBadge.innerHTML = '<span>अंदाजे ₹...</span>';
                budgetBadge.className = 'inline-flex items-center gap-1 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-medium px-3 py-1.5 rounded-xl';
            }
        }

        if (applyBtn) {
            if (detectedData.service || detectedData.area || finalTranscript.trim().length > 3) {
                applyBtn.classList.remove('opacity-50', 'pointer-events-none');
                applyBtn.classList.add('shadow-lg', 'animate-pulse');
            } else {
                applyBtn.classList.add('opacity-50', 'pointer-events-none');
                applyBtn.classList.remove('shadow-lg', 'animate-pulse');
            }
        }
    }

    // --- Web Speech Recognition Core with Robust Auto-KeepAlive ---
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return null;
        }

        const r = new SpeechRecognition();
        r.continuous = true;
        r.interimResults = true;
        r.lang = currentLanguage;

        r.onstart = () => {
            isListening = true;
            updateMicState(true);
            const statusMsg = document.getElementById('voiceStatusMsg');
            if (statusMsg) statusMsg.classList.add('hidden');
        };

        r.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += ' ' + transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            const currentSpoken = (finalTranscript + ' ' + interimTranscript).trim();
            const transcriptBox = document.getElementById('voiceTranscriptLive');
            if (transcriptBox && currentSpoken) {
                transcriptBox.innerText = currentSpoken;
            }

            parseVoiceIntent(currentSpoken);
        };

        r.onerror = (event) => {
            console.warn('[Gharmitra Voice] Recognition error:', event.error);
            // Ignore brief pauses/silences - do not stop!
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                shouldBeListening = false;
                isListening = false;
                updateMicState(false);
                showVoiceStatus("मायक्रोफोन परवानगी (Allow Microphone) नाकारली आहे. कृपया ब्राउझरमध्ये मायक्रोफोन सुरू करा किंवा खाली उदाहरणावर क्लिक करा.", true);
                return;
            }
            if (event.error === 'network') {
                showVoiceStatus("इंटरनेट कनेक्शन तपासा किंवा खालील उदाहरणावर टॅप करा.", true);
            }
        };

        r.onend = () => {
            isListening = false;
            // CRITICAL FIX: If user is in modal and hasn't clicked stop, auto-restart seamlessly!
            if (shouldBeListening) {
                clearTimeout(restartTimer);
                restartTimer = setTimeout(() => {
                    if (shouldBeListening && !isListening) {
                        try {
                            r.lang = currentLanguage;
                            r.start();
                        } catch (e) {
                            console.log('[Gharmitra Voice] KeepAlive restart retry:', e);
                        }
                    }
                }, 150);
            } else {
                updateMicState(false);
            }
        };

        return r;
    }

    function updateMicState(listening) {
        const pulse = document.getElementById('voiceMicPulseRing');
        const icon = document.getElementById('voiceMicIcon');
        const statusText = document.getElementById('voiceStatusText');
        const soundwave = document.getElementById('voiceSoundwaveContainer');

        if (listening) {
            if (pulse) pulse.classList.remove('hidden');
            if (soundwave) soundwave.classList.remove('opacity-20');
            if (soundwave) soundwave.classList.add('opacity-100');
            if (icon) icon.className = 'fa-solid fa-microphone text-white text-3xl';
            if (statusText) statusText.innerText = "मी ऐकत आहे... (बोलत राहा)";
        } else {
            if (pulse) pulse.classList.add('hidden');
            if (soundwave) soundwave.classList.add('opacity-20');
            if (soundwave) soundwave.classList.remove('opacity-100');
            if (icon) icon.className = 'fa-solid fa-microphone-slash text-slate-400 text-3xl';
            if (statusText) statusText.innerText = "माइक थांबला आहे. पुन्हा बोलण्यासाठी माइकवर टॅप करा.";
        }
    }

    function showVoiceStatus(msg, isError) {
        const el = document.getElementById('voiceStatusMsg');
        if (!el) return;
        el.innerText = msg;
        el.className = `p-2.5 rounded-xl text-xs font-semibold text-center ${isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`;
        el.classList.remove('hidden');
    }

    // --- Start / Stop / Restart with Explicit Permission Prime ---
    function startListening() {
        shouldBeListening = true;
        
        // Explicitly request user microphone permission via Web Audio to show native prompt
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    // Stop tracks immediately as SpeechRecognition will handle the microphone
                    stream.getTracks().forEach(track => track.stop());
                    executeStartRecognition();
                })
                .catch((err) => {
                    console.warn('[Gharmitra Voice] getUserMedia error/fallback:', err);
                    executeStartRecognition();
                });
        } else {
            executeStartRecognition();
        }
    }

    function executeStartRecognition() {
        if (!recognition) {
            recognition = initSpeechRecognition();
        }

        if (!recognition) {
            showVoiceStatus("तुमच्या ब्राउझरमध्ये व्हॉइस सपोर्ट नाही. कृपया खाली उदाहरणावर टॅप करा किंवा लिहा.", true);
            return;
        }

        try {
            recognition.lang = currentLanguage;
            recognition.start();
        } catch (e) {
            // If already started, ignore error
            console.log('[Gharmitra Voice] Recognition start:', e);
        }
    }

    function stopListening() {
        shouldBeListening = false;
        clearTimeout(restartTimer);
        if (recognition) {
            try {
                recognition.stop();
            } catch(e) {}
        }
        isListening = false;
        updateMicState(false);
    }

    function toggleListening() {
        if (isListening || shouldBeListening) {
            stopListening();
        } else {
            startListening();
        }
    }

    function restartListening() {
        stopListening();
        finalTranscript = '';
        detectedData = { service: null, area: null, budget: null, issue: '' };
        const transcriptBox = document.getElementById('voiceTranscriptLive');
        if (transcriptBox) transcriptBox.innerText = 'माइक सुरू होत आहे... बोला...';
        const manualInput = document.getElementById('voiceManualInput');
        if (manualInput) manualInput.value = '';
        updateVoicePreviewUI();
        setTimeout(startListening, 200);
    }

    function changeVoiceLanguage(lang) {
        currentLanguage = lang;
        document.querySelectorAll('.voice-lang-btn').forEach(b => {
            if (b.dataset.lang === lang) {
                b.className = 'voice-lang-btn px-3 py-1.5 rounded-xl text-xs font-black bg-blue-600 text-white shadow-md transition';
            } else {
                b.className = 'voice-lang-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition';
            }
        });
        if (shouldBeListening) {
            restartListening();
        }
    }

    // --- 1-Tap Quick Sample Query / Manual Type Handler ---
    function setQuickVoiceSample(sampleText) {
        finalTranscript = sampleText;
        const transcriptBox = document.getElementById('voiceTranscriptLive');
        if (transcriptBox) transcriptBox.innerText = sampleText;
        const manualInput = document.getElementById('voiceManualInput');
        if (manualInput) manualInput.value = sampleText;
        parseVoiceIntent(sampleText);
    }

    // --- Fill Booking Form with Magic Animation ---
    function applyVoiceDataToForm() {
        stopListening();
        closeVoiceBookingModal();

        // 1. Service Select
        const serviceSelect = document.getElementById('serviceSelect');
        if (serviceSelect && detectedData.service) {
            serviceSelect.value = detectedData.service.service;
            highlightField(serviceSelect);
        }

        // 2. Area Select
        const areaSelect = document.getElementById('areaSelect');
        if (areaSelect && detectedData.area) {
            areaSelect.value = detectedData.area;
            highlightField(areaSelect);
        }

        // 3. Address / Problem details
        const addressInput = document.getElementById('customerAddress');
        const textToFill = finalTranscript.trim() || detectedData.issue;
        if (addressInput && textToFill) {
            if (!addressInput.value.trim()) {
                addressInput.value = `[व्हॉइस नोट]: ${textToFill} • पत्ता: `;
            } else {
                addressInput.value += `\n[तक्रार]: ${textToFill}`;
            }
            highlightField(addressInput);
            addressInput.focus();
        }

        // 4. Budget
        const budgetInput = document.getElementById('budgetInput');
        if (budgetInput && detectedData.budget) {
            budgetInput.value = detectedData.budget;
            highlightField(budgetInput);
        }

        // 5. Pre-fill customer details from profile / storage if available
        try {
            const savedProfile = localStorage.getItem('gharmitra_customer_profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                const nameInput = document.getElementById('customerName');
                const mobInput = document.getElementById('customerMobile');
                if (nameInput && !nameInput.value && parsed.name) {
                    nameInput.value = parsed.name;
                    highlightField(nameInput);
                }
                if (mobInput && !mobInput.value && parsed.mobile) {
                    mobInput.value = parsed.mobile;
                    highlightField(mobInput);
                }
            }
        } catch (e) {}

        // 6. Voice Audio Feedback Confirmation (Speech Synthesis)
        speakVoiceConfirmation(detectedData.service ? detectedData.service.nameMr : 'घरकाम सेवा', detectedData.area || 'पुणे');

        // Scroll smoothly to the booking form
        const form = document.getElementById('bookingForm');
        if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function highlightField(elem) {
        elem.classList.add('ring-4', 'ring-emerald-400', 'bg-emerald-50', 'transition-all', 'duration-500');
        setTimeout(() => {
            elem.classList.remove('ring-4', 'ring-emerald-400', 'bg-emerald-50');
        }, 3000);
    }

    // --- Audio Feedback (Speech Synthesis) ---
    function speakVoiceConfirmation(serviceName, areaName) {
        if ('speechSynthesis' in window) {
            try {
                const textToSpeak = `तुमची विनंती समजली! ${serviceName} साठी ${areaName} मध्ये फॉर्म भरला आहे. कृपया मोबाईल नंबर तपासून सबमिट करा.`;
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.lang = currentLanguage;
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            } catch (e) {}
        }
    }

    // --- Modal Controls ---
    function openVoiceBookingModal() {
        const modal = document.getElementById('voiceBookingModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            restartListening();
        }
    }

    function closeVoiceBookingModal() {
        stopListening();
        const modal = document.getElementById('voiceBookingModal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }

    // Attach to Global Window
    window.openVoiceBookingModal = openVoiceBookingModal;
    window.closeVoiceBookingModal = closeVoiceBookingModal;
    window.toggleListening = toggleListening;
    window.restartListening = restartListening;
    window.changeVoiceLanguage = changeVoiceLanguage;
    window.applyVoiceDataToForm = applyVoiceDataToForm;
    window.setQuickVoiceSample = setQuickVoiceSample;

})();
