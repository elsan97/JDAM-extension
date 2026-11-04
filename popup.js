const $go     = document.getElementById("go");
const $status = document.getElementById("status");
const $log    = document.getElementById("logToggle");
const $lang   = document.getElementById("langSelect");

let currentLang = "en";
let translations = {};


chrome.storage.local.get({ jdam_lang: null, jdam_log: false }, (v) => {
  if (v.jdam_lang) {
    currentLang = v.jdam_lang;
  } else {
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'ru') currentLang = 'ru';
    else if (browserLang === 'zh') currentLang = 'zh_CN';
  }
  
  $lang.value = currentLang;
  $log.checked = v.jdam_log;
  loadAndApplyTranslation();
});

$lang.addEventListener("change", () => {
  currentLang = $lang.value;
  chrome.storage.local.set({ jdam_lang: currentLang });
  loadAndApplyTranslation();
});

$log.addEventListener("change", () => {
  chrome.storage.local.set({ jdam_log: $log.checked });
  setStatus($log.checked ? (currentLang === 'ru' ? "Логирование ВКЛ" : "Logging ON") : (currentLang === 'ru' ? "Логирование ВЫКЛ" : "Logging OFF"));
});

// Загружаем JSON переводов напрямую из файлов
async function loadAndApplyTranslation() {
  try {
    const response = await fetch(`_locales/${currentLang}/messages.json`);
    translations = await response.json();
    applyTranslation();
  } catch (e) {
    console.error("Ошибка загрузки перевода:", e);
  }
}

function applyTranslation() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key] && translations[key].message) {
      el.textContent = translations[key].message;
    }
  });
}

function getMsg(key) {
  return translations[key] ? translations[key].message : key;
}

function setStatus(text, isErr = false) {
  $status.textContent = text;
  $status.className = "status" + (isErr ? " err" : "");
}


$go.addEventListener("click", async () => {
  $go.disabled = true;
  setStatus(getMsg("statusActive"));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus(getMsg("statusErr"), true);
    $go.disabled = false;
    return;
  }

  const url = tab.url || "";
  if (/^(chrome|edge|about|opera|brave|vivaldi|chrome-extension|moz-extension):/i.test(url) || url.includes("chromewebstore.google.com")) {
    setStatus(getMsg("statusErr"), true);
    $go.disabled = false;
    return;
  }

  const wantLog = $log.checked;

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await new Promise(r => setTimeout(r, 50));
    const res = await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE", log: wantLog });
    
    if (res && res.ok) {
      window.close();
    } else {
      throw new Error("No response");
    }
  } catch (e) {
    setStatus(getMsg("statusErr"), true);
    $go.disabled = false;
  }
});