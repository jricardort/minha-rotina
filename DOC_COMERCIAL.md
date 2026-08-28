# Minha Rotina — Documento Comercial

> **Última atualização:** 18/08/2026 (era v4 do plano de treino — reestruturação rumo ao sub-60)
> Documento vivo: deve ser atualizado sempre que uma funcionalidade for adicionada, alterada ou removida do app.

## O que é

**Minha Rotina** é um aplicativo web pessoal de saúde e rotina que reúne, em um único lugar, tudo o que uma pessoa precisa para acompanhar sua evolução física: treinos, alimentação, medições corporais, lista de compras e tarefas. Ele foi criado sob medida para acompanhar um plano real de treinamento (10k de Munique e Meia Maratona de Berlim) e um plano alimentar prescrito por nutricionista.

- **Acesso:** https://jricardort.github.io/minha-rotina/ (funciona em qualquer navegador, otimizado para celular)
- **Instalável:** é um PWA — pode ser adicionado à tela inicial do iPhone/Android e usado como app nativo, inclusive offline
- **Sincronizado:** login com Google mantém os dados salvos na nuvem e disponíveis em qualquer aparelho

## Objetivo

Substituir a colcha de retalhos de planilhas, apps de academia, apps de dieta e anotações soltas por **uma única tela de comando da rotina**, com dados que conversam entre si: o treino do dia alimenta o gasto calórico, que alimenta o balanço energético da dieta, que se reflete na evolução do peso e das medidas.

## Principais funções

### 📅 Calendário
- Visão mensal com marcação de treinos realizados, eventos e feriados
- Treino do dia em destaque, com plano da semana (periodização automática até as provas)
- Contagem regressiva para as provas-alvo (10k Munique e Meia de Berlim)
- Registro de "treino cumprido" ou substituição do treino (outro esporte, descanso, lesão etc.), preservando o plano original

### 🏋️ Treino
- Plano de treino periodizado gerado automaticamente por data (musculação + corrida por zonas de FC)
- **Plano adaptativo por "era"**: o plano é reescrito quando a realidade muda (parada por lesão/viagem, mudança de meta, novo compromisso fixo na semana) sem apagar o histórico do que já foi feito
- **Dias com atividade alternativa**: um dia pode ter uma atividade prioritária (ex.: futebol semanal) e um "Plano B" de corrida embutido, para quando ela não acontecer
- **Encaixe com a vida real**: quando a agenda social (festa, viagem, Oktoberfest) bate no treino-chave, o plano remaneja o dia — antecipa o longão para um dia de semana ou muda o horário — em vez de simplesmente marcar falta
- Registro de cargas por exercício com histórico e gráfico de evolução
- Registro de corridas: tempo por zona cardíaca, distância, parciais por km e pace médio
- **Registro de pedal, separado da corrida**: distância, velocidade média, calorias do relógio, tempo por zona e parciais por km com tempo e frequência cardíaca — com histórico próprio de percursos, sem contaminar as estatísticas de corrida
- Zonas de treino personalizáveis a partir de teste de FC
- Estatísticas de aderência ao plano e histórico completo
- Exercícios extras por dia e edição do modelo semanal

### 🍽️ Dieta
- Plano alimentar da nutricionista embutido no app (grupos de alimentos e porções)
- **Construtor de refeições:** monta a refeição escolhendo alimentos do plano; calorias e macros calculados automaticamente
- **Refeição personalizada:** modo livre com acesso a TODAS as categorias e alimentos do banco, com nome definido pelo usuário (café da tarde, almoço de domingo etc.)
- Banco de alimentos editável: cadastro de alimentos próprios (com foto do rótulo) e ajuste dos valores da base
- Registro de extras: cervejas (por tipo e volume, com kcal/carbo calculados) e refeições "off" com presets (pizza, japonês etc.)
- Controle de água, metas diárias de macros e limites semanais de cerveja/refeições off
- Balanço energético diário: consumo vs. gasto (basal + treino), com histórico por dia

### ⚖️ Medições
- Registro de pesagens da balança: peso, % gordura, % músculo, % proteína, % água e taxa basal
- Métricas calculadas automaticamente: IMC, kg de gordura, kg de músculo
- Gráficos de evolução por métrica, com destaque para as medições **enviadas à nutricionista** (✓ nutri)
- **Filtro "só nutri":** o gráfico pode exibir somente as medições oficiais enviadas à nutri, escondendo pesagens intermediárias
- Painel de metas e dashboard de emagrecimento (projeções e progresso)

### 🛒 Compras
- Lista de compras com categorias, quantidades e status (sugerido → aceito → comprado)
- Histórico de compras confirmadas

### ✅ Tarefas
- Lista de tarefas com datas, integrada ao calendário

## Diferenciais

1. **Tudo em um** — treino, dieta, medições, compras e tarefas em um único app, com dados integrados (ex.: o treino do dia entra no cálculo do gasto calórico da dieta).
2. **Fiel ao plano real** — o plano da nutricionista e a periodização de corrida estão embutidos; registrar uma refeição é escolher entre as opções reais do plano, não digitar calorias de cabeça.
3. **Flexível quando precisa** — refeições personalizadas, alimentos próprios, treinos substituídos e refeições "off" são cidadãos de primeira classe, sem quebrar o histórico.
4. **Histórico preservado** — mudanças de plano valem por "eras" (por data): alterar o plano de hoje não reescreve o passado.
5. **Offline-first** — funciona sem internet; sincroniza com a nuvem quando logado. Zero fricção: abre instantaneamente, sem loading.
6. **Privado** — dados pessoais ficam na conta Google do próprio usuário (Firebase), com regras que impedem acesso por terceiros.
7. **Sem mensalidade, sem anúncio** — hospedado gratuitamente no GitHub Pages.

## Público e uso

App de uso pessoal (single-user), moldado à rotina do Zé Ricardo: plano de corrida rumo ao 10k de Munique (**11/10/2026 — meta sub-60**) e à Meia de Berlim (abr/2027), acompanhamento nutricional com nutricionista no Brasil e rotina de musculação em Munique. A arquitetura, porém, permite adaptar o mesmo modelo para qualquer pessoa com plano de treino + dieta.

A semana atual (era v4, desde 19/08/2026) é: musculação de pernas na segunda, futebol na terça, corrida fácil na quarta, corrida de qualidade na quinta, superior na sexta, longão no sábado e descanso no domingo.
