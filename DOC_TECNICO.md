# Minha Rotina — Documentação Técnica

> **Última atualização:** 09/09/2026 (upper migra para as terças; semana de Milão)
> **Regra de manutenção:** este documento é referência de trabalho. Toda alteração no app que mude arquitetura, chaves de dados, esquema ou fluxo crítico DEVE ser refletida aqui. Números de linha são aproximados e derivam — use os **nomes de funções/constantes como âncoras** (grep) em vez de confiar na linha.

## 1. Visão geral

- **Tipo:** SPA estática em **arquivo único** — todo HTML, CSS e JS vivem em `index.html` (~3,7k linhas). Sem build, sem bundler, sem dependências locais.
- **Stack:** Vanilla JS + Chart.js (CDN) + Tabler Icons (CDN) + Firebase compat SDK (CDN: app, auth, firestore).
- **Hospedagem:** GitHub Pages — repo `github.com/jricardort/minha-rotina`, branch `main`, publica em `https://jricardort.github.io/minha-rotina/`. Deploy = `git push` (ao vivo em ~1 min).
- **PWA:** `manifest.json` + `sw.js` (service worker de cache; registrado no fim do `index.html`). Ícones: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
- **Idioma/formatação:** pt-BR. Números usam vírgula decimal na UI — **sempre** converter entrada com `parseBR()` e exibir com `formatBR()`/`.replace('.',',')`.

## 2. Estrutura do arquivo `index.html`

| Bloco | Conteúdo | Âncora |
|---|---|---|
| ~1–370 | `<head>`, CSS inline, manifest/ícones | `<style>` |
| ~377–383 | Barra de navegação (6 abas) | `id="tab-..."`, `switchTab` |
| ~386–433 | Seções das abas: `sec-calendario`, `sec-treino`, `sec-dieta`, `sec-compras`, `sec-medicoes`, `sec-tarefas` | `class="sec"` |
| ~434–455 | Modais (todos `div.modal-bg`): plano-nutri, foods, food-edit, add-exercise, compra, **meal-builder**, extras, meal, beer, goals, kcal-workout, override, run, workout, med, event, task… | `id="modal-*"` |
| ~457–520 | Constantes de domínio: `HOLIDAYS`, `MONTHS`, `START_DATE`, `RACE_DATE`, `MUNIQUE`, `BERLIM`, blocos de musculação (`MUSC_*`, `CORE_BLOCK`) | |
| ~502–650 | Geração do plano de treino: `dk()`, `dateFromKey()`, `generatePlan()`, `planForDayKey()`, `getWorkoutForDate()` | |
| ~650–760 | Migrações pontuais + `ensureDay`, `DEFAULT_GOALS`, estado `userFoods`/`foodOverrides` | `migrate*` |
| ~758–940 | Banco de alimentos (modal "Meus alimentos"): `getAllFoodCategories`, `renderFoodsList`, `saveFoodEdit` | |
| ~940–1360 | Exercícios extras, cerveja (`BEER_TYPES`), suplementos, gasto calórico (`calcBalance`, `estimateRunKcal`), aderência, zonas FC (`BPM_ZONES`, `computeZones`) | |
| ~1362–1930 | Aba Treino: `renderPlan`, modais de carga (`saveWeight`/`weightLog`), corrida (`saveRun`, splits, pace), override de treino, editor semanal | |
| ~1985–2100 | Aba Medições/Balança: `medMeta`, `medData`, `renderMedChart`, `toggleNutriOnly`, `saveMed` | |
| ~2100–2230 | Eventos do calendário e Tarefas | |
| ~2232–2600 | Dieta — refeições: `saveMeal` (manual), `MEAL_BUILDER_OPTIONS`, **meal builder** (`renderMealBuilder`, `saveMealBuilder`, `getAllMealBuilderOptions`), extras/off, favoritos | |
| ~2600–2950 | Cerveja, metas, água, kcal treino, painel de metas (`renderGoalsPanel`), dashboard emagrecimento, `renderDiet` | |
| ~2947–3170 | Calendário (`renderCal`, `renderDetail`), histórico de dieta | |
| ~3174–3370 | Compras (`COMPRA_CATEGORIES`, `renderCompras`, status flow) | |
| ~3369–3400 | `switchMedSubtab`, `switchTab`, boot inicial | |
| ~3400–3700 | **Firebase sync** (ver §4) | `KEYS`, `stableStr`, `syncNow` |
| ~3710–fim | Registro do service worker | `serviceWorker` |

## 3. Modelo de dados (localStorage = fonte de verdade em sessão)

Chaves sincronizadas com a nuvem (constante `KEYS`, ~linha 3447):
`events, tasks, medData, weightLog, workoutTemplate, cardioLog, bikeLog, coreLog, workoutOverrides, diet, dietGoals, dietFavorites, workoutKcal, exerciseRenames, comprasList, comprasHistorico, userZones, dayExtraExercises, userFoods, foodOverrides`

Esquemas principais:

- **`diet`** — `{ 'YYYY-MM-DD': { meals:[], beers:[], water:ml, supplements:{} } }`
  - `meal`: `{id, name, time:'HH:MM', kcal, prot, carb, gord, items:'a · b · c', type}`
  - `type` ∈ `cafe|lanche_manha|almoco|pre_treino|pos_treino|jantar|jantar_pos|ceia|extra|off|custom` (só `'off'` tem lógica própria — limite semanal em `countOffMealsThisWeek`)
- **`medData`** — array de `{data:'YYYY-MM-DD', peso, gordura, musculo, proteina, agua, basal, nutriSent?:true}` — `nutriSent` marca medição enviada à nutricionista (renderiza ponto verde + badge "✓ nutri")
- **`bikeLog`** — `{ exKey: [{date, km, kcal, z1..z5, total, avgSpeed, splits:[{t,bpm}], splitKm, label, note}] }` — pedais. `avgSpeed` em km/h (string pt-BR com vírgula), `splits` por km com tempo e FC; a velocidade de cada parcial é **derivada** do tempo e da distância do trecho, não armazenada. `splitKm` diz se cada parcial vale 1 km ou 5 km (ver invariante 25); ausente = 1 km, para entradas anteriores a 30/08/2026. `label` guarda o nome da linha do plano para o histórico global conseguir nomear o percurso.
- **`weightLog`** — `{ exKey: [{date, weight, ...}] }` — cargas de musculação; `exKey` vem de `getExKey()` — **preservar a chave ao renomear exercícios** (há `exerciseRenames` para display)
- **`workoutOverrides`** — `{ 'YYYY-MM-DD': {type, title, duration, note} }` — substituições de treino por dia; `type:'cumprido'` marca plano feito
- **`cardioLog`** — `{ exKey: [{date, km, z1..z5, total, splits:[pace], splitBpm:[bpm], avgPace, note}] }` — `splits` são **strings de pace** e `splitBpm` é um array **paralelo** de FC por km (ver invariante 26).
- **`dayExtraExercises`** — `{ 'YYYY-MM-DD': [{id, type, label, addedAt}] }` — atividades avulsas do dia. `type` ∈ `musc|bike|corrida|alongamento|mobilidade|core|sauna|livre`, mas quem decide o controle de registro na tela é o **label**, não o type (ver invariante 21).
- **`userFoods`** / **`foodOverrides`** — alimentos do usuário e overrides da base (por `name`); categorias = nomes de grupos de `MEAL_BUILDER_OPTIONS`
- **`dietGoals`**, **`dietFavorites`**, **`userZones`** (zonas FC), **`cardioLog`**, **`coreLog`**, **`workoutKcal`** (gasto manual por dia), **`comprasList`/`comprasHistorico`**

Preferências locais **não sincronizadas**: `medNutriOnly` ('1'/'0') — filtro do gráfico da balança.

## 4. Sincronização Firebase

- **Projeto:** `zes-rotina` · Auth Google · Firestore doc único: `users/{uid}/data/main`. Domínio autorizado: `jricardort.github.io` (⚠️ login NÃO funciona em localhost — testar lógica de sync só em produção).
- **Fluxo:** cada `localStorage.setItem` relevante é seguido de `window.syncNow()` (debounced) → grava o snapshot das `KEYS` no Firestore. No login/snapshot remoto, `applyCloudData()` grava no localStorage e chama `window.refreshDataFromStorage()` que re-hidrata as variáveis globais **in-place e re-renderiza sem reload**.
- **`stableStr()`**: comparação JSON com chaves ordenadas — evita falso "difere" por reordenação de chaves do Firestore (`cloudDiffers`). Não remover.
- **Regra de ouro:** ao criar uma nova chave de dado sincronizável, adicioná-la em **três lugares**: constante `KEYS`, `refreshDataFromStorage()` e no carregamento inicial da variável global.
- **Leitura externa:** `node firebase-zes/ler-dados.js` (fora do repo, em `C:\Users\User\firebase-zes\`) lê o snapshot real do Firestore (chave de service account fora do repo).

## 5. Caminhos críticos e invariantes

1. **Plano de treino é retroativo por "eras"** — `generatePlan`/`planForDayKey` derivam o treino da DATA. Mudanças de plano devem ser aplicadas por data de corte (era v1/v2/v3/v4), nunca editando a lista global, senão o histórico passado muda. Mesma lógica para listas de exercícios.
   - Cortes atuais: `<11/06` → `planOld` · `=11/06` → `plan`(v2) · `12/06–28/06` → `planNew` · `29/06–18/08` → `planV3` · `>=19/08` (`V4_START`) → `planV4`.
   - **A era v4 substitui as semanas 15–22 inteiras** (bloco `if(isV4){...return p;}` dentro de `generatePlan`). Semanas 1–14 são idênticas entre v3 e v4 — por isso `isV3` inclui `isV4`.
   - ⚠️ **Cabeçalho da semana vs. dia**: fase/cor/número vinham de `plan[i]` (sempre v2) enquanto o dia vinha de `planForDayKey`. Corrigido com `weekMeta(i)` (usa `planV4` para `i>=14`). Ao criar uma era nova que renomeie fases, atualizar `weekMeta`.
2. **`getExKey()` é a chave do histórico de cargas** — renomear exercício na UI usa `exerciseRenames`; mudar a string base do exercício órfã o histórico em `weightLog`.
   - `exerciseRenames` sobrevive a mudanças de plano e pode **mascarar** um exercício que voltou ao template com nome de outro. Ao reintroduzir exercícios, checar renames órfãos (ver `migrateRenamesV4` e `V4_STALE_RENAMES`).
3. **Meal builder** (`modal-meal-builder`):
   - `MEAL_BUILDER_OPTIONS` = plano da nutri por tipo de refeição (revisão de **03/07/2026**); itens por unidade (`kcal/prot/carb/gord`) ou por 100g (`kcalP100...` + `defaultG` = quantidade auto-preenchida).
   - Tipos: `cafe`, `lanche_manha` (pão + cottage 40g), `almoco` (carbo 80g/massa 100g, leguminosa 80g, proteína 120g, 3 ovos), `pre_treino` (fruta + ½ whey musculação; fruta + pão + cottage corrida), `pos_treino` (whey + banana se jantar >1h + iogurte proteico substituto), `jantar` (porção menor), `jantar_pos` (carbo 80g, leguminosa 100g, proteína 100g, 2 ovos), `ceia`, `extra`.
   - `getMealOptionsForCategory(type)` aplica `foodOverrides` e anexa `userFoods` por categoria (match exato com nome do grupo).
   - **Tipo `custom` (refeição personalizada):** `getAllMealBuilderOptions()` mescla TODOS os grupos de todos os tipos (dedup por grupo — normaliza sufixos `" · porção menor)"`, `" · jantar pós-treino)"` e `" · pré-corrida)"` — e por nome de item, first-wins na ordem de definição de `MEAL_BUILDER_OPTIONS`) + todos os `userFoods`. Nome obrigatório via `#mb-custom-name`; salvo como `name:'🍽️ <nome>'`, `type:'custom'`.
4. **Gráfico da balança** (`renderMedChart`): 3 datasets — linha carry-forward, pontos reais, overlay verde `nutriSent`. O filtro `medNutriOnly` (checkbox `#med-nutri-only`, `toggleNutriOnly()`) filtra só o **gráfico** (`chartData`); resumo (`renderMedSummary`) e histórico continuam com `medData` completo.
5. **Balanço calórico** (`calcBalance`): gasto = basal (última medição) + treino (manual em `workoutKcal` OU estimado de musculação+corrida do dia). Alterar estimativas afeta o dashboard de emagrecimento.
6. **Migrações**: padrão = função `migrate*()` idempotente chamada no boot (ex.: `migrateJunho`, `applyChurrascoPizzaMigration`). Novas correções de dados históricos seguem esse padrão.
7. **Segurança de render:** strings de usuário passam por `escapeHtml()` antes de entrar em `innerHTML`. Manter.
8. **IMC:** `calcIMC` usa altura fixa embutida (`peso/3.0276` ⇒ 1,74 m). A meta de peso fica em `renderEmagDashboard` (`target`, hoje **74 kg**; início 83,5).
9. **Linhas de nota no template não são exercício** — `isNoteLine()` (prefixos `⚡ 📍 ✈️ 💧 😴 🎽 🍝 📊 ⛔ ⚽ ─ ·` ou linha terminada em `:`) é avaliada **antes** de `isRunning()`, senão uma nota contendo "km" ("⚡ MARCO: os primeiros 10km") vira botão de registro de corrida. Notas caem no ramo `isCard` e renderizam como texto puro.
10. **`PACE_ZONES` e `EASY_GLIDE` são calibrados pela meta da prova** — recalibrados em 18/08/2026 para sub-60 (Z2 = 7:05-7:40/km; glide 7:40 → 7:05/km). Antes: Z2 = 6:00-6:20/km e glide até 6:30/km, calibrados para sub-55 — exibiam como "fácil" um pace praticamente de prova, o que empurrava todo treino Z2 para Z3/Z4. **Ao mudar a meta da prova, recalibrar os dois juntos.**
11. **Painel de metas ignora dados velhos** — `renderGoalsPanel` mostra aviso de "sem corrida há N dias" quando a última corrida tem mais de 14 dias, em vez de exibir pace antigo como se fosse o estado atual.
12. **Dia de descanso é marcado por `rest:true`, não pelo título** — `dayIsRest(day)` é a única fonte de verdade (`day.rest===true || day.t==='Descanso'`). Até a v3 todo descanso era o `REST_DAY` literal; a v4 usa títulos descritivos (`'⛔ OFF — volta de Leipzig'`), e um OFF planejado sem a flag é contado como **falta** na aderência e ganha botão "Cumprido" indevidamente. ⚠️ Nem todo título com `⛔` é descanso (`'⛔ Futebol SUSPENSO — trote leve'` tem corrida) — por isso a flag explícita em vez de regex no título. Usado em 6 pontos (aderência, `renderPlan`, `renderTreinoHistorico`, `renderDetail`, status do dia, calendário).
13. **Aderência conta a partir do plano vigente** — `PLAN_RESET` (= `V4_START`) é o piso de `getAdherenceStats`. Dias anteriores à reestruturação pertencem a outro plano e contariam como falta em massa. Quando a janela de N dias é cortada pelo piso, `stats.clipped` fica `true` e o rótulo do card vira "desde o plano novo · DD/MM" em vez de "últimos 14 dias". **Ao criar uma era nova que reinicie a contagem, atualizar `PLAN_RESET`.**

14. **Ajustes pontuais de calendário usam `SPECIAL_WORKOUTS`, não uma era nova** — `SPECIAL_WORKOUTS['YYYY-MM-DD']` sobrepõe o dia em TODOS os renders (`getWorkoutForDate`, `renderPlan`, `renderTreinoHistorico`, `renderInfoPlan`, `renderDetail`) e na aderência. Por ser indexado por data, é intrinsecamente não-retroativo: não cria era, não mexe em `PLAN_RESET`/`weekMeta` e não órfã chave de `weightLog`.
    - Aplicado em **28/08/2026** para a agenda social de set/out (16 datas, de 29/08 a 06/10): Aniversário Aline, Wannda Circus, Churrasco Leozão, **Oktoberfest** e Jantar ADI.
    - Regra de negócio adotada: o longão **muda de horário** (sábado de manhã) quando o evento é à tarde/noite; só **muda de dia** quando o fim de semana inteiro está tomado — caso único do **longão-chave de 12km**, que saiu de sáb 26/09 para qui 24/09 e depois para **seg 21/09**, quando o Oktoberfest ADI (24/09, 11h30-17h) tomou o terceiro dia da semana. Nessa semana o longão absorve a qualidade e os 5×1km saem.
    - ⚠️ Ao escrever notas de evento, usar um prefixo reconhecido por `isNoteLine()` — a lista ganhou `🍺 🎂 🎪 🥩 🍽️ 🔄`, depois `🚴 🚆`, `⚖️`, `👟`, `🎧` e `✈️`. Sem prefixo, uma linha como "🍺 Oktoberfest 10h–16h" não casa com `isCardio()` e cai no ramo de musculação, ganhando botão de carga.
15. **`renderInfoPlan` (Plano Completo do modal) precisa respeitar a era** — iterava `plan` (v2) e mostrava os treinos pré-v4 nas semanas 15–22. Corrigido em 26/08/2026: cabeçalho vem de `weekMeta(wi)` e o dia de `planForDayKey(dayKey)[wi].template[di]`, com `SPECIAL_WORKOUTS` por cima. `phaseColor`/`phaseBg` também passaram a reconhecer `Pico` (v4) além de `Peak` (v2).

16. **`index.html` é fonte de dados para um consumidor EXTERNO** — a assistente Claudia (`C:UsersUserclaudiasrc	reino.js`) não duplica o plano: ela **recorta o texto** do `index.html` e executa num `vm` isolado para chamar `getWorkoutForDate`. O briefing dela cruza o treino com a previsão do tempo.
    - Ela localiza os blocos por **prefixo de linha**: `const START_DATE=` até `function getWorkoutForDate` (fechando na primeira linha igual a `}`), e `const SPECIAL_WORKOUTS={` até a primeira linha começando em `};`.
    - ⚠️ **Não reformatar essas declarações** (minificar, mudar indentação da abertura, mover `SPECIAL_WORKOUTS` para dentro de outro escopo) sem rodar `node src/treino.js AAAA-MM-DD` na Claudia depois. Ela falha alto de propósito — briefing sem treino é ruim, briefing com treino errado é pior.
    - Ela detecta corrida no dia por regex sobre título+`ex` (`corrida|long ?run|longão|z2|z3|strides|intervalado|tempo run|time trial`) e sessão noturna por `🌙`/`FIM DO DIA`. Manter esse vocabulário nos títulos.
17. **Horário de sessão vai em linha de nota, não no nome do exercício** — prefixar a linha do exercício com hora (`⏰ 09:00 — Long Run 7km`) muda o `getExKey()` e órfã o histórico em `cardioLog`. Os horários entram como linhas `📍` separadas.
    - Pelo mesmo motivo, atividade que **não é corrida** (pedal, caminhada) entra como linha de nota com prefixo próprio: sem isso `isRunning()` casa com o "km" e cria um botão de registro que gravaria um pedal de 14 km como corrida, distorcendo pace médio e volume.

18. **`bikeLog` é separado de `cardioLog` por decisão de projeto, não por acaso** — `goalRuns()` e o painel do sub-60 agregam `cardioLog` para calcular pace médio e volume de corrida. Um pedal de 14 km a ~2:00/km entrando lá destruiria os dois números, que são justamente o critério da meta. **Nunca unificar os dois logs.**
    - O pedal entra no balanço calórico pelo mesmo balde de cardio (`getDayKcalSpent` soma `bikeKcalForDay`), mas com METs de ciclismo (`z1:4 … z5:12`, contra `z1:7 … z5:16` da corrida) e dando prioridade à caloria informada pelo relógio.
    - O histórico do pedal é **global** (`allBikeRides()` varre todas as chaves), ao contrário do da corrida que é por exercício: trajeto de bike muda de nome a cada dia e por chave o histórico ficaria em cacos.
19. **Ordem das checagens de linha no `renderPlan`: `isBikeLine` → `isNoteLine` → `isRunning`** — `🚴` é prefixo de nota (senão `isRunning` casa com o "km" e cria botão de corrida), então sem avaliar `isBikeLine` primeiro o pedal nunca ganharia botão próprio. Só existe **um** caminho de render com essas checagens (`renderPlan`); ao criar outro, replicar a ordem.
20. **O modal do pedal usa `.bike-time-group`, não `.time-input-group`** — `buildZoneTimePickers()` varre `.time-input-group` globalmente e reescreve o `innerHTML` com ids `r-<zona>-*`. Reaproveitar a classe no modal do pedal geraria ids duplicados e quebraria os dois modais.

21. **Exercício extra precisa do MESMO controle de registro do plano** — até 28/08/2026 os itens de `dayExtraExercises` renderizavam como texto puro com um `×`: o usuário adicionava "Cadeira extensora" e não tinha onde lançar a carga, então o dado nunca entrava em `weightLog` e sumia da progressão. `extraControlHTML(label,dayKey)` resolve reaplicando a ordem de decisão do plano (pedal → nota → corrida → core → cardio → carga).
    - É uma **segunda** implementação da mesma decisão, deliberadamente separada do `renderPlan` para não mexer num caminho que funciona. Ao mudar a ordem em um, mudar no outro (invariante 19).
    - O label é a fonte da verdade, não o `type` do extra: assim um extra colado à mão ou vindo de versão antiga continua funcionando.
22. **O nome do extra decide se ele soma ao histórico ou abre um órfão** — `getExKey()` é a chave, então "Cadeira extensora 3x10" e "Perna: extensora - 3x10 - 32kg" viram séries diferentes. Por isso o campo de nome tem `<datalist>` alimentado por `knownExerciseNames()` (chaves de `weightLog` + exercícios do plano vigente) e `updateAeHistHint()` avisa ao vivo se o nome digitado cai num histórico existente e qual foi a última carga.
23. **Extra de bicicleta guarda só o trajeto no label** (`🚴 Bike — <trajeto>`) — distância e tempo vão no registro. Se fossem para o label, cada pedal geraria uma chave nova de `getExKey()` e o botão nunca mostraria o pedal anterior daquele trajeto.
    - ⚠️ Ao inserir `<option>` em `<select>` por busca de texto, **conferir qual select recebeu**: `<option value="corrida">🏃 Corrida</option>` existe em `#ev-cat` (categoria de evento) **e** em `#ae-type` (tipo de exercício). Ancorar pelo vizinho único.

24. **Exercício extra tem que sair nos DOIS ramos do `renderPlan`** — o ramo do treino substituído (`else if(ov)`) dá `return` antes da lista de exercícios. Até 28/08/2026, trocar o treino do dia **e** adicionar extras fazia os extras sumirem da tela, junto com o botão de registro deles. O bloco virou `extrasBlockHTML(dayKey)` e é emitido nos dois ramos, sempre **antes** do `</div>` que fecha a `.treino-day` — emitir depois joga os extras para fora do dia e desbalanceia o HTML.

25. **Parciais do pedal são segmentadas por distância, não fixas em 1 km** — `bikeSegKm(km)` devolve 5 acima de `BIKE_SPLIT_LIMIAR` (10 km) e 1 abaixo, espelhando o iOS, que passa a entregar médias a cada 5 km quando o pedal ultrapassa 10 km. Um pedal de 30 km abria 30 campos e era inviável de preencher à mão; agora abre 6.
    - `bikeSplitParts(km,seg)` é a fonte única dos trechos e é usada nos **três** pontos: montagem dos campos, cálculo da velocidade ao digitar e exibição no histórico. O último trecho pode ser parcial (23 km → `km 21–23`); sobra menor que 1 km vira `últimos X km`, porque `km 11–10,5` não se lê.
    - A velocidade de cada trecho usa a distância **dele** (`dist*3600/seg`), não 1 km fixo. Sem `splitKm` gravado na entrada, o histórico exibiria velocidade 5× menor.
    - O campo de minutos do trecho aceita até 599: 5 km em ritmo baixo passa de 59 min.

26. **FC por km da corrida vai num array PARALELO (`splitBpm`), não dentro de `splits`** — diferente do pedal, que nasceu com `splits:[{t,bpm}]`. Motivo: `cardioLog.splits` é uma lista de strings de pace desde 12/06/2026 e alimenta `avgPaceFromSplits()`, lido em quatro pontos; trocar a forma exigiria migrar o histórico e mexer em todos eles. A assimetria é deliberada — **não "uniformizar" os dois sem migração**.
    - `splitBpm[i]` corresponde a `splits[i]`. Registro sem `splitBpm` (anterior a 01/09/2026) renderiza normalmente, só sem FC.
    - `zoneForBpm(bpm)` mapeia FC → zona pelas faixas de `userZones` (do teste de FCmáx). Devolve `null` quando não há `fcmax` configurado, e a badge mostra —. Acima do topo da Z5, satura em Z5.
    - Objetivo: cruzar pace e zona parcial a parcial. A análise de 29/08 ficou em aberto porque só havia tempo por zona agregado do dia inteiro, sem saber a que ritmo cada zona foi atingida.

27. **Dia de teste tem UMA linha de corrida, nunca uma por fase** — `goalRuns()` deduplica por data ficando com a **maior distância**, então um teste de 5 km lançado como 2+2+1 entra no painel de metas como corrida de 2 km, e `avgPaceFromSplits` só fecha sobre a corrida inteira. As fases (aquecimento, blocos de ritmo, desaquecimento) são linhas de **nota** com prefixo `·`.
    - Isso também conserta um efeito colateral antigo: `Aquecimento 10min Z2` e `Desaquecimento 5min Z1` não casam com `isRunning()` nem com `isCardio()` e caíam no ramo final, ganhando botão de **carga**. Toda linha de instrução dentro de um dia de corrida precisa de prefixo de nota.

### Migrações da era v4 (18/08/2026)

| Função | O que corrige |
|---|---|
| `migrateRenamesV4` | Remove renames órfãos (`V4_STALE_RENAMES`) que mascarariam Stiff halteres, Afundo búlgaro, Panturrilha sentado e Tríceps corda no plano v4 |
| `migrateEventsV4` | Move o lembrete `tt-reassess-reminder` de 07/09 → **14/09** (o TT de 5K passou de 04/09 para 11/09) e adiciona o evento `ironman-leipzig` em 23/08 |
| `migrateMedMusculoJul24` | Corrige `medData` de 24/07: campo `musculo` recebeu 55,6 (valor em **kg**) num campo que guarda **%**; ajustado para 73,5 |

Todas são idempotentes e estão registradas **duas vezes**: no escopo do módulo (boot) e dentro de `refreshDataFromStorage()` (após carga da nuvem) — sem o segundo ponto, o snapshot do Firestore sobrescreve a correção.

## 6. Workflow de desenvolvimento

1. **SEMPRE** antes de editar: `git fetch origin && git status` no clone `C:\Users\User\minha-rotina\` (exigência do usuário — evita clobber).
2. Editar `index.html` (único arquivo de app).
3. Teste local: servidor estático (`.claude/launch.json` → `python -m http.server 8765 --directory minha-rotina`). App roda offline/deslogado em localhost (banner "MODO OFFLINE" é esperado; login Google não funciona fora do domínio autorizado).
4. Commit em português descritivo + push para `main` → GitHub Pages publica em ~1 min.
5. Atualizar `DOC_TECNICO.md` / `DOC_COMERCIAL.md` se a mudança tocar arquitetura, esquema ou funcionalidades.
6. Cache PWA (`sw.js`): `index.html` é **network-first** — deploys aparecem imediatamente mesmo no PWA instalado; CDNs/ícones são stale-while-revalidate; Firebase/Google nunca passam pelo cache. Só é preciso trocar a constante `CACHE` (`treino-v1`) se o próprio `sw.js` mudar.

## 7. Arquivos do repositório

| Arquivo | Papel |
|---|---|
| `index.html` | App inteiro (HTML+CSS+JS) |
| `sw.js` | Service worker (cache PWA) |
| `manifest.json` | Manifest PWA |
| `icon-192/512.png`, `apple-touch-icon.png` | Ícones |
| `DOC_COMERCIAL.md` / `DOC_TECNICO.md` | Estes documentos |
| `REVISAO_CODEX.md` | Revisão externa avulsa (untracked, não faz parte do app) |
