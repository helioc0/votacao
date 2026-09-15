const $ = (id) => document.getElementById(id);
const configured =
  window.VOTA_SUPABASE_URL && window.VOTA_SUPABASE_PUBLISHABLE_KEY;
const db = configured
  ? window.supabase.createClient(
      window.VOTA_SUPABASE_URL,
      window.VOTA_SUPABASE_PUBLISHABLE_KEY,
    )
  : null;
let state = { active: null, history: [] };
let managerPin = "";

const timeLeft = () =>
  state.active
    ? Math.max(0, Math.ceil((state.active.endsAt - Date.now()) / 1000))
    : 0;
const clock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const stats = (item = state.active) => {
  if (item?.metrics)
    return {
      ...item.metrics,
      percent: item.metrics.total
        ? Math.round((item.metrics.yes / item.metrics.total) * 100)
        : 0,
    };
  const all = Object.values(item?.votes || {}),
    yes = all.filter((v) => v === "yes").length;
  return {
    total: all.length,
    yes,
    percent: all.length ? Math.round((yes / all.length) * 100) : 0,
  };
};
const safe = (value) => {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
};
async function signedIn() {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (session) return;
  const { error } = await db.auth.signInAnonymously();
  if (error) throw error;
}
async function publicState() {
  await signedIn();
  const { data, error } = await db.rpc("public_voting_state");
  if (error) throw error;
  state = {
    active: data?.id
      ? {
          ...data,
          startedAt: new Date(data.startedAt).getTime(),
          endsAt: new Date(data.endsAt).getTime(),
        }
      : null,
    history: [],
  };
  render();
}
async function manage(action, values = {}) {
  // A Edge Function exige um JWT válido. Uma sessão anónima fornece-o sem pedir dados ao votante.
  await signedIn();
  const { data, error } = await db.functions.invoke("manage", {
    body: { action, ...values },
    headers: { "x-manager-pin": managerPin },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
function renderHistory() {
  const records = state.history || [];
  $("historyCount").textContent =
    `${records.length} registo${records.length === 1 ? "" : "s"}`;
  $("historyList").innerHTML = records.length
    ? records
        .map((item) => {
          const s = stats(item),
            date = new Date(item.endedAt || item.endsAt).toLocaleString(
              "pt-PT",
              { dateStyle: "medium", timeStyle: "short" },
            );
          return `<article class="history-item"><div><strong>${safe(item.subject)}</strong><small class="date">Encerrada em ${date}</small></div><div><strong class="rate">${s.percent}%</strong><small>aceitação</small></div><div><strong>${s.yes}</strong><small>votos “Sim” · ${s.total} total</small></div></article>`;
        })
        .join("")
    : '<p class="empty-history">Ainda não há votações concluídas.</p>';
}
function render() {
  const open = state.active && timeLeft() > 0,
    mine = state.active?.myVote,
    s = stats();
  $("voteQuestion").textContent = state.active
    ? `${state.active.subject} passa?`
    : "Aguardando a próxima votação";
  $("statusText").textContent = open ? "VOTAÇÃO EM CURSO" : "SEM VOTAÇÃO ATIVA";
  $("timer").textContent = open ? clock(timeLeft()) : "—";
  $("voteHelper").textContent = configured
    ? open
      ? "Escolha a sua resposta. Pode mudar o voto enquanto o tempo estiver a decorrer."
      : "O gestor ainda não iniciou uma votação."
    : "Configure o Supabase para ativar as votações.";
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
  $("activeTitle").textContent = state.active
    ? `${state.active.subject} passa?`
    : "Sem votação ativa";
  $("yesPercent").textContent = state.active ? `${s.percent}%` : "—";
  $("yesCount").textContent = s.yes;
  $("totalCount").textContent = s.total;
  $("approvalBar").style.width = `${s.percent}%`;
  $("activeTimer").textContent = open ? `Termina em ${clock(timeLeft())}` : "—";
  $("endVote").disabled = !state.active;
  renderHistory();
}
document.querySelectorAll(".choice").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      const { data, error } = await db.rpc("cast_vote", {
        target_session: state.active.id,
        selected_choice: button.dataset.vote,
      });
      if (error) throw error;
      state.active = {
        ...data,
        startedAt: new Date(data.startedAt).getTime(),
        endsAt: new Date(data.endsAt).getTime(),
      };
      if (navigator.vibrate) navigator.vibrate(18);
      render();
    } catch (error) {
      $("voteNote").textContent = error.message;
    }
  }),
);
$("openManager").addEventListener("click", () => {
  $("pinError").classList.add("hidden");
  $("pin").value = "";
  $("pinDialog").showModal();
  setTimeout(() => $("pin").focus(), 100);
});
$("cancelPin").addEventListener("click", () => $("pinDialog").close());
$("pinForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  managerPin = $("pin").value;
  try {
    await manage("verify");
    $("pinDialog").close();
    $("voteView").classList.add("hidden");
    $("managerView").classList.remove("hidden");
    state = await manage("state");
    render();
  } catch (error) {
    managerPin = "";
    $("pinError").textContent = error?.message || "PIN inválido ou a função de gestão não está acessível.";
    $("pinError").classList.remove("hidden");
    if (navigator.vibrate) navigator.vibrate([30, 35, 30]);
  }
});
$("closeManager").addEventListener("click", () => {
  managerPin = "";
  $("managerView").classList.add("hidden");
  $("voteView").classList.remove("hidden");
  publicState();
});
$("newVoteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    state = await manage("start", {
      subject: $("subject").value,
      minutes: Number($("duration").value),
    });
    $("subject").value = "";
    render();
  } catch (error) {
    alert(error.message);
  }
});
$("endVote").addEventListener("click", async () => {
  try {
    state = await manage("end");
    render();
  } catch (error) {
    alert(error.message);
  }
});
if (configured) {
  publicState();
  setInterval(() => {
    if (managerPin && !$("managerView").classList.contains("hidden"))
      manage("state").then((result) => {
        state = result;
        render();
      });
    else publicState();
  }, 2500);
} else render();
