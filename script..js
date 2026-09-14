const storageKey = "vota-app-data-v1";
const voterKey = "vota-voter-id-v1";
const state = JSON.parse(
  localStorage.getItem(storageKey) || '{"active":null,"history":[]}',
);
const voterId =
  localStorage.getItem(voterKey) ||
  (() => {
    const id = crypto.randomUUID();
    localStorage.setItem(voterKey, id);
    return id;
  })();
const $ = (id) => document.getElementById(id);

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function getRemaining() {
  return state.active
    ? Math.max(0, Math.ceil((state.active.endsAt - Date.now()) / 1000))
    : 0;
}
function votes() {
  return state.active ? Object.values(state.active.votes || {}) : [];
}
function metrics(item = state.active) {
  const all = Object.values(item?.votes || {});
  const yes = all.filter((v) => v === "yes").length;
  return {
    total: all.length,
    yes,
    percent: all.length ? Math.round((yes / all.length) * 100) : 0,
  };
}
function endActiveVote() {
  if (!state.active) return;
  const item = { ...state.active, endedAt: Date.now() };
  state.history.unshift(item);
  state.active = null;
  save();
}
function isOpen() {
  return state.active && getRemaining() > 0;
}

function render() {
  if (state.active && getRemaining() === 0) endActiveVote();
  const open = isOpen();
  const active = state.active;
  const mine = active?.votes?.[voterId];
  $("voteQuestion").textContent = active
    ? `${active.subject} passa?`
    : "Aguardando a próxima votação";
  $("statusText").textContent = open
    ? "VOTAÇÃO EM CURSO"
    : active
      ? "VOTAÇÃO ENCERRADA"
      : "SEM VOTAÇÃO ATIVA";
  $("timer").textContent = open ? formatTime(getRemaining()) : "—";
  $("voteHelper").textContent = open
    ? "Escolha a sua resposta. Pode mudar o voto enquanto o tempo estiver a decorrer."
    : active
      ? "O período de votação terminou."
      : "O gestor ainda não iniciou uma votação.";
  document.querySelectorAll(".choice").forEach((button) => {
    button.disabled = !open;
    button.classList.toggle("selected", button.dataset.vote === mine);
  });
  $("voteNote").textContent =
    mine && open
      ? `Voto registado: “${mine === "yes" ? "Sim" : "Não"}”. Pode alterá-lo até ao fim.`
      : open
        ? "O seu voto é privado e pode ser alterado durante a votação."
        : "O seu voto é privado.";
  const stat = metrics();
  $("activeTitle").textContent = active
    ? `${active.subject} passa?`
    : "Sem votação ativa";
  $("yesPercent").textContent = active ? `${stat.percent}%` : "—";
  $("yesCount").textContent = stat.yes;
  $("totalCount").textContent = stat.total;
  $("approvalBar").style.width = `${stat.percent}%`;
  $("activeTimer").textContent = open
    ? `Termina em ${formatTime(getRemaining())}`
    : "—";
  $("endVote").disabled = !active;
  renderHistory();
}
function renderHistory() {
  const list = $("historyList");
  const history = state.history || [];
  $("historyCount").textContent =
    `${history.length} registo${history.length === 1 ? "" : "s"}`;
  if (!history.length) {
    list.innerHTML =
      '<p class="empty-history">Ainda não há votações concluídas.</p>';
    return;
  }
  list.innerHTML = history
    .map((item) => {
      const stat = metrics(item);
      const date = new Date(item.endedAt || item.endsAt).toLocaleString(
        "pt-PT",
        { dateStyle: "medium", timeStyle: "short" },
      );
      return `<article class="history-item"><div><strong>${escapeHtml(item.subject)}</strong><small class="date">Encerrada em ${date}</small></div><div><strong class="rate">${stat.percent}%</strong><small>aceitação</small></div><div><strong>${stat.yes}</strong><small>votos “Sim” · ${stat.total} total</small></div></article>`;
    })
    .join("");
}
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

document.querySelectorAll(".choice").forEach((button) =>
  button.addEventListener("click", () => {
    if (!isOpen()) return;
    state.active.votes[voterId] = button.dataset.vote;
    save();
    if (navigator.vibrate) navigator.vibrate(18);
    render();
  }),
);
$("openManager").addEventListener("click", () => {
  $("pinError").classList.add("hidden");
  $("pin").value = "";
  $("pinDialog").showModal();
  setTimeout(() => $("pin").focus(), 100);
});
$("cancelPin").addEventListener("click", () => $("pinDialog").close());
$("pinForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("pin").value !== "1234") {
    $("pinError").classList.remove("hidden");
    if (navigator.vibrate) navigator.vibrate([30, 35, 30]);
    return;
  }
  $("pinDialog").close();
  $("voteView").classList.add("hidden");
  $("managerView").classList.remove("hidden");
  render();
});
$("closeManager").addEventListener("click", () => {
  $("managerView").classList.add("hidden");
  $("voteView").classList.remove("hidden");
});
$("newVoteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const subject = $("subject").value.trim();
  const minutes = Number($("duration").value);
  if (!subject || !minutes) return;
  if (state.active) endActiveVote();
  state.active = {
    id: crypto.randomUUID(),
    subject,
    startedAt: Date.now(),
    endsAt: Date.now() + minutes * 60000,
    votes: {},
  };
  save();
  $("subject").value = "";
  render();
});
$("endVote").addEventListener("click", () => {
  if (!state.active) return;
  endActiveVote();
  render();
});
render();
setInterval(render, 1000);
