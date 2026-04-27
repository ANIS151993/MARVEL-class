import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.MARVEL_CONFIG ?? {};

const input = document.querySelector("#input-box");
const button = document.querySelector("#submit-button");
const showContainer = document.querySelector("#show-container");
const listContainer = document.querySelector("#autocomplete-list");
const statusBanner = document.querySelector("#status-banner");
const authShell = document.querySelector("#auth-shell");
const authForm = document.querySelector("#auth-form");
const authEmailInput = document.querySelector("#auth-email");
const authPasswordInput = document.querySelector("#auth-password");
const authSubmitButton = document.querySelector("#auth-submit");
const authMessage = document.querySelector("#auth-message");
const authHelper = document.querySelector("#auth-helper");
const signInTab = document.querySelector("#signin-tab");
const signUpTab = document.querySelector("#signup-tab");
const accountPanel = document.querySelector("#account-panel");
const accountEmail = document.querySelector("#account-email");
const signOutButton = document.querySelector("#signout-button");

let characters = [];
let currentCharacter = null;
let authMode = "signin";
let activeSession = null;
let supabase = null;

const demoCharacters = [
  {
    id: 1,
    marvel_id: 1009610,
    name: "Spider-Man",
    description:
      "Bitten by a radioactive spider, Peter Parker balances street-level responsibility with Avenger-scale stakes.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1635865165118-917ed9e20936?auto=format&fit=crop&w=900&q=80",
    image_available: true,
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 2,
    marvel_id: 1009220,
    name: "Captain Marvel",
    description:
      "Carol Danvers brings cosmic-level power, military precision, and a clean silhouette for a standout card layout.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=900&q=80",
    image_available: true,
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 3,
    marvel_id: 1009608,
    name: "Loki",
    description:
      "A shapeshifting manipulator whose profile works well as a moody contrast against the brighter hero cards.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1624213111452-35e8d3d5cc16?auto=format&fit=crop&w=900&q=80",
    image_available: true,
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showBanner(message) {
  statusBanner.classList.remove("hidden");
  statusBanner.innerHTML = message;
}

function showAuthMessage(message, tone = "info") {
  authMessage.classList.remove("hidden", "success", "error");
  if (tone) {
    authMessage.classList.add(tone);
  }
  authMessage.textContent = message;
}

function clearAuthMessage() {
  authMessage.classList.add("hidden");
  authMessage.classList.remove("success", "error");
  authMessage.textContent = "";
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignIn = mode === "signin";

  signInTab.classList.toggle("active", isSignIn);
  signUpTab.classList.toggle("active", !isSignIn);
  signInTab.setAttribute("aria-pressed", String(isSignIn));
  signUpTab.setAttribute("aria-pressed", String(!isSignIn));

  authPasswordInput.autocomplete = isSignIn ? "current-password" : "new-password";
  authSubmitButton.textContent = isSignIn ? "Unlock Access" : "Create Account";
  authHelper.textContent = isSignIn
    ? "Sign in with the email and password from your Supabase account."
    : "Use a real email address. Supabase may send a confirmation email before the account can sign in.";
  clearAuthMessage();
}

function setAuthenticatedUi(session) {
  activeSession = session;
  const isSignedIn = Boolean(session?.user);

  document.body.classList.toggle("authenticated", isSignedIn);
  authShell.classList.toggle("hidden", isSignedIn);
  accountPanel.classList.toggle("hidden", !isSignedIn);

  if (isSignedIn) {
    accountEmail.textContent = session.user.email ?? "Unknown user";
  } else {
    accountEmail.textContent = "";
    input.value = "";
    removeElements();
    showContainer.innerHTML = "";
    showBanner("Authentication required. Sign in to browse the Marvel dataset.");
  }
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalizeCharacter(record, index) {
  return {
    id: record?.id ?? index + 1,
    marvelId: record?.marvel_id ?? "Unknown",
    name: String(record?.name ?? `Character ${index + 1}`).trim(),
    alias: record?.slug || "Marvel Database Record",
    description: record?.description || "No description available.",
    publisher: "Marvel",
    imageAvailable: Boolean(record?.image_available),
    createdAt: record?.created_at || "",
    updatedAt: record?.updated_at || "",
    image: record?.thumbnail_url || config.imageFallback,
  };
}

function removeElements() {
  listContainer.innerHTML = "";
}

function displayWords(value) {
  input.value = value;
  removeElements();
}

function addAlphabetHeaders() {
  const items = listContainer.querySelectorAll(".autocomplete-items");
  let lastLetter = "";

  items.forEach((item) => {
    const letter = item.getAttribute("data-letter");
    if (letter !== lastLetter) {
      const header = document.createElement("div");
      header.classList.add("alpha-header");
      header.textContent = letter;
      listContainer.insertBefore(header, item);
      lastLetter = letter;
    }
  });
}

function buildDropdownItems(list, searchTerm) {
  removeElements();

  list.forEach((character) => {
    const name = character.name;
    const div = document.createElement("div");
    div.classList.add("autocomplete-items");
    div.addEventListener("click", () => displayWords(name));

    let word = escapeHtml(name);
    if (searchTerm) {
      const idx = name.toLowerCase().indexOf(searchTerm.toLowerCase());
      if (idx !== -1) {
        word =
          escapeHtml(name.slice(0, idx)) +
          "<b>" +
          escapeHtml(name.slice(idx, idx + searchTerm.length)) +
          "</b>" +
          escapeHtml(name.slice(idx + searchTerm.length));
      }
    }

    div.setAttribute("data-letter", name[0].toUpperCase());
    div.innerHTML = `<p class="item"><span>${word}</span><small>#${escapeHtml(character.marvelId)}</small></p>`;
    listContainer.appendChild(div);
  });

  if (!searchTerm) {
    addAlphabetHeaders();
  }
}

function buildInlineFallbackSvg(name) {
  const initials =
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?";

  const safeName = escapeHtml(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2d0810"/>
          <stop offset="100%" stop-color="#041327"/>
        </linearGradient>
      </defs>
      <rect width="640" height="520" fill="url(#bg)"/>
      <circle cx="520" cy="80" r="150" fill="#f7d117" opacity="0.25"/>
      <circle cx="120" cy="450" r="160" fill="#ff4b4b" opacity="0.24"/>
      <text x="50%" y="46%" text-anchor="middle" fill="#f8fafc" font-size="132" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
      <text x="50%" y="62%" text-anchor="middle" fill="#cbd5e1" font-size="28" font-family="Arial, sans-serif">${safeName}</text>
      <text x="50%" y="72%" text-anchor="middle" fill="#94a3b8" font-size="18" font-family="Arial, sans-serif">Image unavailable</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setInlineFallback(imgEl, name) {
  imgEl.onerror = null;
  imgEl.src = buildInlineFallbackSvg(name);
}

function showLoading() {
  showContainer.innerHTML = `
    <div class="loading-card">
      <div class="shimmer-img"></div>
      <div class="shimmer-line" style="width:55%"></div>
      <div class="shimmer-line" style="width:35%"></div>
      <div class="shimmer-line" style="width:70%"></div>
      <div class="shimmer-line" style="width:60%;margin-bottom:1.5em"></div>
    </div>`;
}

function downloadImage(url, filename) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.jpg`;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.click();
}

function showCard(character) {
  currentCharacter = character;
  const safeName = escapeHtml(character.name);
  const safeDescription = escapeHtml(character.description);
  const safeAlias = escapeHtml(character.alias);
  const imageStatus = character.imageAvailable ? "AVAILABLE" : "NO IMAGE";

  showContainer.innerHTML = `
    <div class="card-container">
      <div class="card-image-wrapper">
        <img id="char-img" src="${escapeHtml(character.image)}" alt="${safeName}" />
        <div class="card-image-id">Marvel ID: ${escapeHtml(character.marvelId)}</div>
        <button class="download-btn" id="download-button" type="button">Download</button>
      </div>

      <div class="card-body">
        <div class="character-name">${safeName}</div>
        <div class="meta-row">
          <span class="type-chip">MARVEL</span>
          <span class="generation-chip">Record ${escapeHtml(character.id)}</span>
        </div>
        <div class="divider"></div>
        <div class="info-list">
          <div class="info-row">
            <span class="info-label">STATUS</span>
            <span class="info-value">${imageStatus}</span>
          </div>
          <div class="info-row">
            <span class="info-label">ALIAS</span>
            <span class="info-value">${safeAlias}</span>
          </div>
          <div class="info-row">
            <span class="info-label">PUBLISHER</span>
            <span class="info-value">${escapeHtml(character.publisher)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">DESCRIPTION</span>
            <span class="info-value">${safeDescription}</span>
          </div>
          <div class="info-row">
            <span class="info-label">CREATED</span>
            <span class="info-value">${escapeHtml(formatDate(character.createdAt))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">UPDATED</span>
            <span class="info-value">${escapeHtml(formatDate(character.updatedAt))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">MARVEL ID</span>
            <span class="info-value">${escapeHtml(character.marvelId)}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const imageEl = document.querySelector("#char-img");
  imageEl.onerror = () => setInlineFallback(imageEl, character.name);

  document
    .querySelector("#download-button")
    .addEventListener("click", () => downloadImage(character.image, character.name));
}

function findCharacter(rawValue) {
  const value = rawValue.trim().toLowerCase();
  if (!value) {
    return null;
  }

  const exactByName = characters.find((character) => character.name.toLowerCase() === value);
  if (exactByName) {
    return exactByName;
  }

  return characters.find((character) => String(character.marvelId) === value) ?? null;
}

function hasSupabaseCredentials() {
  return (
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.includes("YOUR_SUPABASE") &&
    !config.supabaseAnonKey.includes("YOUR_SUPABASE")
  );
}

async function loadCharacters() {
  showLoading();

  const { data, error } = await supabase.from(config.table).select("*");

  if (error) {
    characters = demoCharacters.map(normalizeCharacter);
    showBanner(`Supabase query failed, so demo data is being shown. <code>${escapeHtml(error.message)}</code>`);
  } else {
    characters = (data ?? []).map(normalizeCharacter).sort((a, b) => a.name.localeCompare(b.name));
    showBanner(
      `Signed in as <strong>${escapeHtml(activeSession?.user?.email ?? "user")}</strong>. Loaded <strong>${characters.length}</strong> Marvel characters from <code>${escapeHtml(config.table)}</code>.`
    );
  }

  if (!characters.length) {
    showContainer.innerHTML = `
      <div class="not-found">
        <span>&#9888;</span>
        Unable to load Marvel dataset.
      </div>`;
    return;
  }

  const random = characters[Math.floor(Math.random() * characters.length)];
  input.value = random.name;
  buildDropdownItems(characters, "");
  showCard(random);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  clearAuthMessage();

  if (!supabase) {
    showAuthMessage("Supabase config is missing. Update config.js with your project URL and anon key.", "error");
    return;
  }

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    showAuthMessage("Email and password are required.", "error");
    return;
  }

  authSubmitButton.disabled = true;
  authSubmitButton.textContent = authMode === "signin" ? "Signing In..." : "Creating Account...";

  try {
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      authPasswordInput.value = "";
      if (data.session) {
        showAuthMessage("Account created and signed in.", "success");
      } else {
        showAuthMessage(
          "Account created. Check your email for the confirmation link, then return here and sign in.",
          "success"
        );
        setAuthMode("signin");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    authPasswordInput.value = "";
    clearAuthMessage();
  } catch (error) {
    showAuthMessage(error.message || "Authentication failed.", "error");
  } finally {
    authSubmitButton.disabled = false;
    authSubmitButton.textContent = authMode === "signin" ? "Unlock Access" : "Create Account";
  }
}

async function initializeAuth() {
  if (!hasSupabaseCredentials()) {
    authSubmitButton.disabled = true;
    showAuthMessage("Supabase config is missing. Update config.js first, then refresh the page.", "error");
    showBanner("Authentication is disabled until Supabase credentials are configured.");
    return;
  }

  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    showAuthMessage(error.message || "Unable to restore the current session.", "error");
  }

  setAuthenticatedUi(session);
  if (session) {
    await loadCharacters();
  } else {
    showBanner("Authentication required. Sign in to browse the Marvel dataset.");
  }

  supabase.auth.onAuthStateChange(async (event, sessionValue) => {
    setAuthenticatedUi(sessionValue);

    if (event === "SIGNED_IN") {
      clearAuthMessage();
      await loadCharacters();
      return;
    }

    if (event === "SIGNED_OUT") {
      characters = [];
      currentCharacter = null;
      showBanner("You have been signed out. Sign in again to browse the Marvel dataset.");
      authPasswordInput.value = "";
    }
  });
}

input.addEventListener("focus", () => {
  if (
    input.value.trim().length === 0 ||
    characters.some((character) => character.name.toLowerCase() === input.value.toLowerCase())
  ) {
    buildDropdownItems(characters, "");
  }
});

input.addEventListener("click", () => {
  if (listContainer.innerHTML === "") {
    buildDropdownItems(characters, "");
  }
});

input.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    return;
  }

  const searchTerm = input.value.trim();
  if (searchTerm.length === 0) {
    buildDropdownItems(characters, "");
    return;
  }

  const matches = characters.filter(
    (character) =>
      character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(character.marvelId).includes(searchTerm)
  );

  if (matches.length > 0) {
    buildDropdownItems(matches, searchTerm);
  } else {
    removeElements();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrapper")) {
    removeElements();
  }
});

button.addEventListener("click", () => {
  const value = input.value.trim();
  if (!value) {
    window.alert("Input cannot be blank");
    return;
  }

  removeElements();
  showLoading();

  window.setTimeout(() => {
    const character = findCharacter(value);
    if (!character) {
      showContainer.innerHTML = `
        <div class="not-found">
          <span>&#128269;</span>
          Marvel character not found.<br />Click the search bar to browse all characters.
        </div>`;
      return;
    }

    showCard(character);
  }, 250);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    button.click();
  }
});

signInTab.addEventListener("click", () => setAuthMode("signin"));
signUpTab.addEventListener("click", () => setAuthMode("signup"));
authForm.addEventListener("submit", handleAuthSubmit);
signOutButton.addEventListener("click", async () => {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
});

setAuthMode("signin");
setAuthenticatedUi(null);
initializeAuth();
