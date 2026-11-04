(function() {
  if (window.__jdam_loaded) return;
  window.__jdam_loaded = true;

  let modeActive = false;
  let logEnabled = false;

  function getOverlay() {
    let overlay = document.getElementById("jdam-overlay-root");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "jdam-overlay-root";
      
      Object.assign(overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        pointerEvents: "none", 
        zIndex: "2147483647",
      });
      document.body.appendChild(overlay);

      const shadow = overlay.attachShadow({ mode: "open" });
      
      const style = document.createElement("style");
      style.textContent = `
        .jdam-bomb {
          position: absolute;
          width: 80px !important; 
          height: 80px !important; 
          object-fit: contain !important;
          aspect-ratio: 1 / 1 !important;
          pointer-events: none;
          transform-origin: center center !important;
          filter: drop-shadow(0 0 10px rgba(0,0,0,0.7));
          will-change: transform, top;
        }
        .jdam-boom {
          position: absolute;
          width: 300px !important;
          height: 300px !important;
          object-fit: contain !important;
          aspect-ratio: 1 / 1 !important;
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0.1);
          transform-origin: center center !important;
          opacity: 0;
          animation: jdam-explode 1.5s ease-out forwards;
        }
        @keyframes jdam-explode {
          0%   { transform: translate(-50%, -50%) scale(0.1); opacity: 0; }
          15%  { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
          50%  { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
          80%  { transform: translate(-50%, -50%) scale(2.2); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(3.0); opacity: 0; }
        }
        .jdam-emoji-bomb {
          position: absolute;
          font-size: 64px !important;
          line-height: 1 !important;
          pointer-events: none;
          transform-origin: center center !important;
          text-align: center;
        }
        .jdam-emoji-boom {
          position: absolute;
          font-size: 120px !important;
          line-height: 1 !important;
          pointer-events: none;
          transform-origin: center center !important;
          text-align: center;
          animation: jdam-explode 1.5s ease-out forwards;
        }
      `;
      shadow.appendChild(style);
    }
    return overlay.shadowRoot;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "ACTIVATE") {
      logEnabled = !!msg.log;
      if (!modeActive) {
        modeActive = true;
        enableTargeting();
      }
      sendResponse({ ok: true });
    }
    return true;
  });

  function enableTargeting() {
    document.body.style.cursor = "crosshair";
    
    const handler = (e) => {
      if (!modeActive) return;
      modeActive = false;
      document.body.style.cursor = "";
      document.removeEventListener("click", handler, true);
      
      e.preventDefault();
      e.stopPropagation();

      const x = e.clientX;
      const y = e.clientY;

      if (logEnabled) {
        console.log("%c[JDAM] 🎯 ЦЕЛЬ ЗАХВАЧЕНА", "color:#e74c3c;font-weight:bold", { x, y });
      }
      
      dropBomb(x, y);
    };
    
    document.addEventListener("click", handler, true);
  }

  function dropBomb(targetX, targetY) {
    const shadow = getOverlay();

    const bomb = document.createElement("img");
    bomb.src = chrome.runtime.getURL("bomb.png");
    bomb.className = "jdam-bomb";
    
    const startX = targetX; 
    const startY = -300; 

    bomb.style.left = startX + "px";
    bomb.style.top = startY + "px";
    bomb.style.transform = `translate(-50%, -50%) rotate(0deg)`;

    bomb.onerror = () => {
      const emoji = document.createElement("div");
      emoji.textContent = "💣";
      emoji.className = "jdam-emoji-bomb";
      emoji.style.left = startX + "px";
      emoji.style.top = startY + "px";
      emoji.style.transform = `translate(-50%, -50%) rotate(0deg)`;
      bomb.replaceWith(emoji);
      animateFall(emoji, startX, startY, targetX, targetY);
    };

    shadow.appendChild(bomb);
    animateFall(bomb, startX, startY, targetX, targetY);

    setTimeout(() => {
      const shakeKeyframes = [
        { transform: "translate(0,0)" },
        { transform: "translate(-6px,4px)" },
        { transform: "translate(6px,-4px)" },
        { transform: "translate(0,0)" },
      ];
      const overlay = document.getElementById("jdam-overlay-root");
      if (overlay) {
        overlay.animate(shakeKeyframes, { duration: 400, iterations: 3 });
      }
    }, 1200); 
  }

  function animateFall(el, startX, startY, targetX, targetY) {
    const duration = 1500; 
    const t0 = performance.now();

    function fall(now) {
      const t = Math.min((now - t0) / duration, 1);
      const eased = t * t; 

      const curY = startY + (targetY - startY) * eased;
      const angleDeg = t * -90; 

      el.style.left = startX + "px";
      el.style.top = curY + "px";
      el.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;

      if (t < 1) {
        requestAnimationFrame(fall);
      } else {
        el.remove();
        explode(targetX, targetY);
      }
    }

    requestAnimationFrame(fall);
  }

  function explode(x, y) {
    const shadow = getOverlay();

    const boom = document.createElement("img");
    boom.src = chrome.runtime.getURL("boom.png");
    boom.className = "jdam-boom";
    
    boom.style.left = x + "px";
    boom.style.top = y + "px";

    boom.onerror = () => {
      const emoji = document.createElement("div");
      emoji.textContent = "💥";
      emoji.className = "jdam-emoji-boom";
      emoji.style.left = x + "px";
      emoji.style.top = y + "px";
      
      boom.replaceWith(emoji);
      setTimeout(() => emoji.remove(), 2000);
    };

    shadow.appendChild(boom);
    playBoomSound();

    setTimeout(() => boom.remove(), 2000);
  }

  function playBoomSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(60, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(15, ctx.currentTime + 1.5);
      
      gain1.gain.setValueAtTime(0.8, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 1.5);

      const bufferSize = ctx.sampleRate * 1.5; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.0);

      const gainNoise = ctx.createGain();
      gainNoise.gain.setValueAtTime(0.6, ctx.currentTime);
      gainNoise.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

      noise.connect(filter).connect(gainNoise).connect(ctx.destination);
      noise.start();
    } catch (e) {
      if (logEnabled) console.warn("[JDAM] Звук не сработал:", e);
    }
  }
})();