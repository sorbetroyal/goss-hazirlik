// --- AYARLAR ---
// Farklı test gruplarınızı buraya ekleyin.
// Linkleri tırnak içine yapıştırın.
const QUIZ_GROUPS = [
    {
        name: "Hukuk",
        icon: "⚖️",
        url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQuE4p4g-6iRK1HKweDjNsUrM6AJeHSsvvFR_mHnt3NT0_CyWju-PMWJGedmPRftT68p4CmkhTLIN62/pub?output=csv"
    },
    {
        name: "Meteoroloji",
        icon: "🌦️",
        url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwmig8WzrKTZhgKq5ypfa2h5Vjhh1Z27L2lW7V-U4BqvTLgUen7EsJ9EsbmK_P2YJ3noMztUiS7Sxh/pub?output=csv"
    },
    {
        name: "Genel Kültür",
        icon: "🌍",
        url: ""
    }
];

// --- API AYARI ---
// Eğer anahtarı her seferinde girmek istemiyorsanız, buraya tırnak içine yapıştırın.
// Örnek: const GENEL_API_KEY = "AIzaSy...";
const GENEL_API_KEY = "AIzaSyDQrJeqm24HwHYMLRv3iV-VV-9XgWpgx00";

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const categorySection = document.getElementById('category-section');
    const statusMsg = document.getElementById('status-msg');

    // Screens
    const startScreen = document.getElementById('start-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const resultScreen = document.getElementById('result-screen');

    // Quiz Elements
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const finishBtn = document.getElementById('finish-btn');
    const quitBtn = document.getElementById('quit-btn');
    const explainBtn = document.getElementById('explain-btn'); // New
    const aiExplanationArea = document.getElementById('ai-explanation-area'); // New
    const aiText = document.getElementById('ai-text'); // New
    const resetApiKeyBtn = document.getElementById('reset-api-key'); // New

    const progressBar = document.getElementById('progress-bar');
    const questionCounter = document.getElementById('question-counter');
    const scoreDisplay = document.getElementById('score-display');

    // Result Elements
    const finalScoreEl = document.getElementById('final-score');
    const resultMessage = document.getElementById('result-message');
    const totalQuestionsEl = document.getElementById('total-questions');
    const correctCountEl = document.getElementById('correct-count');
    const wrongCountEl = document.getElementById('wrong-count');
    const restartBtn = document.getElementById('restart-btn');

    // State
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let userAnswers = [];
    let currentGroupName = "";

    // --- Init Categories ---
    if (categorySection) {
        QUIZ_GROUPS.forEach(group => {
            const btn = document.createElement('div');
            btn.className = 'cat-btn';
            btn.innerHTML = `
                <span class="cat-icon">${group.icon}</span>
                <span class="cat-name">${group.name}</span>
            `;

            btn.addEventListener('click', () => {
                if (!group.url || group.url.length < 10) {
                    showStatus(`${group.name} için henüz bağlantı girilmemiş (Script.js dosyasını düzenleyin).`, 'error');
                    return;
                }

                // Visual feedback
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Set current group
                currentGroupName = group.name;

                // Load
                loadQuizData(group.url);
            });

            categorySection.appendChild(btn);
        });
    }

    // --- Core Logic ---

    function loadQuizData(url) {
        // Fix common Google Sheets link issues
        if (url.includes('docs.google.com/spreadsheets') && url.includes('/edit')) {
            url = url.replace(/\/edit.*$/, '/export?format=csv');
        }

        showStatus('Veriler çekiliyor...', '');

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Ağ hatası: ' + response.status);
                return response.text();
            })
            .then(text => {
                if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('<html')) {
                    throw new Error('Link CSV değil HTML döndürdü. Lütfen doğru CSV linkini kullanın.');
                }
                parseCSV(text);
            })
            .catch(err => {
                console.error(err);
                let msg = 'Bağlantı hatası.';
                if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                    msg = 'Veri çekilemedi. Bağlantı engellendi (CORS). Lütfen script.js dosyasındaki linki kontrol edin.';
                } else {
                    msg = err.message;
                }
                showStatus(msg, 'error');
            });
    }

    function parseCSV(text) {
        const rows = text.split('\n');
        const data = [];

        rows.forEach((row, index) => {
            if (index === 0) return; // Skip header

            row = row.replace('\r', '');
            if (!row.trim()) return;

            // Parser
            const cols = [];
            let currentCol = '';
            let inQuotes = false;

            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') {
                    if (inQuotes && row[i + 1] === '"') {
                        currentCol += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    cols.push(currentCol.trim());
                    currentCol = '';
                } else {
                    currentCol += char;
                }
            }
            cols.push(currentCol.trim());

            if (cols.length >= 8) {
                data.push({
                    question: cols[1],
                    options: cols.slice(2, 7),
                    answer: cols[7]
                });
            }
        });

        if (data.length > 0) {
            // --- SMART SHUFFLE LOGIC ---
            const storageKey = `seen_history_${currentGroupName}`;
            let seenHistory = [];
            try {
                seenHistory = JSON.parse(localStorage.getItem(storageKey)) || [];
            } catch (e) { seenHistory = []; }

            let unseenQuestions = data.filter(q => !seenHistory.includes(q.question));
            let seenQuestions = data.filter(q => seenHistory.includes(q.question));
            let historyReset = false;

            // AUTO-RESET: Eğer hiç yeni soru kalmadıysa tarihçeyi sıfırla
            if (unseenQuestions.length === 0) {
                localStorage.removeItem(storageKey); // Kaydı sil
                seenHistory = [];
                unseenQuestions = [...data]; // Hepsini yeni say
                seenQuestions = [];
                historyReset = true;
            }

            let selectedQuestions = [];

            // Shuffle both arrays
            shuffleArray(unseenQuestions);
            shuffleArray(seenQuestions);

            // Prioritize Unseen
            if (unseenQuestions.length >= 20) {
                selectedQuestions = unseenQuestions.slice(0, 20);
            } else {
                selectedQuestions = [...unseenQuestions];
                const needed = 20 - selectedQuestions.length;
                if (seenQuestions.length > 0) {
                    selectedQuestions = selectedQuestions.concat(seenQuestions.slice(0, needed));
                }
            }

            // Update History
            const newSeenIds = selectedQuestions.map(q => q.question);
            const updatedHistory = [...new Set([...seenHistory, ...newSeenIds])];

            try {
                localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
            } catch (e) {
                console.warn("Storage error", e);
            }

            questions = selectedQuestions;
            shuffleArray(questions);

            // Status Message Generation
            let infoMsg = "";
            let statusMsg = `${data.length} soru bulundu. `;

            if (historyReset) {
                statusMsg += "Havuza reset atıldı.";
                infoMsg = `🎉 Tebrikler! Tüm soruları bitirdiniz. Tarihçe sıfırlandı, en baştan başlıyoruz!`;
            } else if (unseenQuestions.length > 0) {
                const count = Math.min(20, unseenQuestions.length);
                statusMsg += `Öncelikli olarak ${count} yeni soru seçildi.`;
                infoMsg = `✨ ${count} adet yeni soru öncelikli olarak seçildi.`;
            } else {
                // Should technically not reach here due to reset logic, but fallback safety
                statusMsg += `Karışık mod.`;
                infoMsg = `↺ Karışık mod.`;
            }

            showStatus(statusMsg, 'success');
            setTimeout(() => startQuiz(infoMsg), 1500);
        } else {
            showStatus('Soru bulunamadı. Formatı kontrol edin (En az 8 sütun).', 'error');
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = 'status-msg ' + type;
    }

    // --- Quiz Logic ---

    function startQuiz(infoMsg = "") {
        startScreen.classList.remove('active');
        quizScreen.classList.add('active');

        // Render Info Msg in Quiz Screen
        const infoBar = document.getElementById('quiz-info-bar');
        if (infoBar) {
            infoBar.textContent = infoMsg;
            // Fade out after 5 seconds to not be annoying
            setTimeout(() => {
                infoBar.style.transition = "opacity 1s";
                infoBar.style.opacity = "0";
                setTimeout(() => { infoBar.textContent = ""; infoBar.style.opacity = "0.9"; }, 1000);
            }, 5000);
        }

        currentQuestionIndex = 0;
        score = 0;
        userAnswers = new Array(questions.length).fill(null);
        showQuestion(currentQuestionIndex);
        updateStats();
    }

    function showQuestion(index) {
        const q = questions[index];
        questionText.textContent = q.question;
        questionCounter.textContent = `Soru ${index + 1} / ${questions.length}`;

        const progressPercent = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${progressPercent}%`;

        optionsContainer.innerHTML = '';
        const savedAnswer = userAnswers[index];

        q.options.forEach((opt, optIndex) => {
            if (!opt) return;
            const btn = document.createElement('button');
            btn.classList.add('option-btn');

            const labels = ['A', 'B', 'C', 'D', 'E'];
            btn.innerHTML = `<strong>${labels[optIndex]})</strong> ${opt}`;
            btn.dataset.index = optIndex;

            if (savedAnswer) {
                btn.classList.add('disabled');
                btn.disabled = true;
                if (savedAnswer.selectedOptionIndex === optIndex) {
                    btn.classList.add(savedAnswer.isCorrect ? 'correct' : 'wrong');
                }
                if (!savedAnswer.isCorrect && isCorrectOption(q.answer, opt, optIndex)) {
                    btn.classList.add('correct');
                }
            } else {
                btn.addEventListener('click', () => handleAnswer(index, optIndex, opt));
            }
            optionsContainer.appendChild(btn);
        });

        prevBtn.disabled = index === 0;

        if (savedAnswer) {
            if (index === questions.length - 1) {
                nextBtn.style.display = 'none';
                finishBtn.style.display = 'inline-block';
            } else {
                nextBtn.style.display = 'inline-block';
                finishBtn.style.display = 'none';
            }
            explainBtn.style.display = 'inline-block'; // Show if answered
        } else {
            nextBtn.style.display = 'none';
            finishBtn.style.display = 'none';
            explainBtn.style.display = 'none'; // Hide if new
        }

        // Hide AI area when changing questions
        aiExplanationArea.style.display = 'none';
    }

    function handleAnswer(qIndex, optIndex, optText) {
        const q = questions[qIndex];
        const isCorrect = isCorrectOption(q.answer, optText, optIndex);

        if (isCorrect) score += 5;

        userAnswers[qIndex] = {
            selectedOptionIndex: optIndex,
            isCorrect: isCorrect
        };

        const buttons = optionsContainer.querySelectorAll('.option-btn');
        buttons.forEach((btn, idx) => {
            btn.classList.add('disabled');
            btn.disabled = true;
            if (idx === optIndex) {
                btn.classList.add(isCorrect ? 'correct' : 'wrong');
            }
            if (!isCorrect && isCorrectOption(q.answer, btn.textContent, idx)) {
                btn.classList.add('correct');
            }
        });

        updateStats();

        // Show controls
        explainBtn.style.display = 'inline-block'; // Allow explanation now

        if (qIndex === questions.length - 1) {
            finishBtn.style.display = 'inline-block';
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'inline-block';
            finishBtn.style.display = 'none';
        }
    }

    // Detailed AI Elements
    const detailedExplainLink = document.getElementById('detailed-explain-link');
    const aiDetailedText = document.getElementById('ai-detailed-text');

    // --- AI Logic (Short) ---
    explainBtn.addEventListener('click', async () => {
        // Öncelik: Kodun içine gömülü anahtar
        let apiKey = GENEL_API_KEY || localStorage.getItem('GEMINI_API_KEY');

        if (!apiKey) {
            // Hiçbiri yoksa uyarı ver
            aiExplanationArea.style.display = 'block';
            aiText.innerHTML = `<div style="color:var(--warning)">⚠️ API Anahtarı eksik. script.js dosyasını kontrol edin.</div>`;
            return;
        }

        const q = questions[currentQuestionIndex];
        const correctAnswer = q.options.find((opt, idx) => isCorrectOption(q.answer, opt, idx)) || q.answer;

        // Reset UI for new request
        aiExplanationArea.style.display = 'block';
        document.querySelector('.ai-header').style.display = 'flex';
        aiText.textContent = "Düşünüyorum... 🧠";
        detailedExplainLink.style.display = 'none'; // Hide detail link initially
        aiDetailedText.style.display = 'none';      // Hide detail text
        aiDetailedText.innerHTML = "";
        explainBtn.disabled = true;

        const promptText = `
        Soru: ${q.question}
        Şıklar: ${q.options.join(', ')}
        Doğru Cevap: ${correctAnswer}
        
        Neden bu cevap doğru? Tek bir paragrafta, en fazla 3 cümleyle, çok kısa ve öz açıkla. Hızlı cevap ver.
        `;

        try {
            await fetchAIResponse(apiKey, promptText, (text) => {
                aiText.innerHTML = text.replace(/\n/g, '<br>');
                detailedExplainLink.style.display = 'inline-block'; // Show detail link after success
            });
        } catch (error) {
            handleAIError(error);
        } finally {
            explainBtn.disabled = false;
        }
    });

    // --- AI Logic (Detailed) ---
    if (detailedExplainLink) {
        detailedExplainLink.addEventListener('click', async (e) => {
            e.preventDefault();

            let apiKey = GENEL_API_KEY || localStorage.getItem('GEMINI_API_KEY');
            const q = questions[currentQuestionIndex];
            const correctAnswer = q.options.find((opt, idx) => isCorrectOption(q.answer, opt, idx)) || q.answer;

            detailedExplainLink.style.display = 'none'; // Hide link
            aiDetailedText.style.display = 'block';
            aiDetailedText.textContent = "Detaylı analiz yapılıyor... 🧐";

            const promptText = `
            Soru: ${q.question}
            Şıklar: ${q.options.join(', ')}
            Doğru Cevap: ${correctAnswer}
            
            Bu soruyu ve şıkları detaylıca analiz et.
            1. Önce sorunun ne sorduğunu açıkla.
            2. Sonra HER BİR ŞIKKI (A, B, C...) tek tek ele al. Neden doğru veya neden yanlış olduğunu açıkla.
            3. Konuyla ilgili ek bir bilgi ver.
            Çıktı formatı HTML (bold, list) kullanabilirsin ama root tag olmasın.
            `;

            try {
                await fetchAIResponse(apiKey, promptText, (text) => {
                    aiDetailedText.innerHTML = text.replace(/\n/g, '<br>');
                });
            } catch (error) {
                aiDetailedText.textContent = "Detay alınamadı: " + error.message;
            }
        });
    }

    // Helper functions to clean up code
    async function fetchAIResponse(apiKey, prompt, onSuccess) {
        let modelName = "gemini-2.5-flash"; // Default
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            if (response.status === 404) {
                // Fallback could go here if needed
                throw new Error("Model bulunamadı (404).");
            }
            throw new Error(`Hata: ${response.status}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            onSuccess(data.candidates[0].content.parts[0].text);
        } else {
            throw new Error("Boş cevap döndü.");
        }
    }

    function handleAIError(error) {
        console.error(error);
        const aiText = document.getElementById('ai-text');
        aiText.innerHTML = `<div style="color:var(--error)">Hata: ${error.message}</div>`;
    }

    // Helper to find what models user actually has
    async function checkAvailableModels(apiKey) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!response.ok) throw new Error("Model listesi alınamadı: " + response.status);

            const data = await response.json();
            const models = data.models ? data.models.map(m => m.name.replace('models/', '')).filter(n => n.includes('gemini')) : [];

            if (models.length > 0) {
                let listHtml = models.map(m => `<li>${m}</li>`).join('');
                aiText.innerHTML = `
                    <div style="color: var(--warning);">
                        <strong>⚠️ Hedef model bulunamadı ama şu modeller açık:</strong>
                        <ul style="font-size:0.8rem; margin:10px 0; padding-left:20px;">${listHtml}</ul>
                        <small>Lütfen geliştiriciye (bana) bu listeyi söyleyin, kodu güncelleyeyim.</small>
                    </div>
                `;
            } else {
                aiText.textContent = "⚠️ Anahtarınızla ilişkili hiçbir Gemini modeli bulunamadı.";
            }
        } catch (e) {
            aiText.textContent = "⚠️ Model listesi de alınamadı: " + e.message;
        }
    }

    // Reset Key Listener
    if (resetApiKeyBtn) {
        resetApiKeyBtn.addEventListener('click', () => {
            if (confirm("API Anahtarını silmek ve değiştirmek istiyor musunuz?")) {
                localStorage.removeItem('GEMINI_API_KEY');
                aiText.textContent = "🗑️ Anahtar silindi. Lütfen '✨ Neden?' butonuna tekrar basarak yeni anahtar girin.";
            }
        });
    }

    function isCorrectOption(correctAnswerStr, optionText, optionIndex) {
        if (!correctAnswerStr) return false;
        const cleanAns = correctAnswerStr.toString().trim().toLowerCase();
        const labels = ['a', 'b', 'c', 'd', 'e'];

        if (cleanAns.length === 1 && labels.includes(cleanAns)) {
            return labels[optionIndex] === cleanAns;
        }

        return optionText.toLowerCase().includes(cleanAns) || cleanAns.includes(optionText.toLowerCase());
    }

    function updateStats() {
        scoreDisplay.textContent = `Puan: ${score}`;
    }

    prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            showQuestion(currentQuestionIndex);
        }
    });

    quitBtn.addEventListener('click', () => {
        if (confirm("Testi bitirmek istediğine emin misin?")) {
            showResults();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            showQuestion(currentQuestionIndex);
        }
    });

    finishBtn.addEventListener('click', showResults);
    restartBtn.addEventListener('click', () => location.reload());

    function showResults() {
        quizScreen.classList.remove('active');
        resultScreen.classList.add('active');

        const correctCount = userAnswers.filter(a => a && a.isCorrect).length;
        const wrongCount = userAnswers.filter(a => a && !a.isCorrect).length;
        const answeredCount = userAnswers.filter(a => a).length;
        const emptyCount = questions.length - answeredCount;

        totalQuestionsEl.textContent = questions.length;
        correctCountEl.textContent = correctCount;
        wrongCountEl.textContent = wrongCount + emptyCount;
        finalScoreEl.textContent = score;

        const successRate = correctCount / questions.length;
        if (successRate > 0.8) resultMessage.textContent = "Mükemmel!";
        else if (successRate > 0.5) resultMessage.textContent = "Gayet İyi.";
        else resultMessage.textContent = "Çalışmaya Devam.";
    }

});
