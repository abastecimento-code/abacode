# Atualizar os relatórios gerenciais Globus

Os três relatórios oficiais usados pelo painel ficam na raiz do repositório:

- `1000-2999.TXT`
- `200-300.TXT`
- `500-699.TXT`

Os três arquivos devem corresponder ao mesmo período. O importador lê o intervalo diretamente do cabeçalho de cada TXT e interrompe a geração se os períodos forem diferentes ou se houver linha fora do intervalo declarado.

## Reconstrução dos pacotes publicados

O parser oficial está em `scripts/build_globus_data.js`. Ele lê combustível e demais produtos por posições fixas e interpreta o rodapé numérico em sequência. Como valores longos (por exemplo, KM acumulado acima de 999.999) podem ultrapassar a largura visual da coluna, o rodapé não deve ser lido por fatias fixas. O importador aceita os quatro campos básicos (hodômetro inicial, hodômetro final, KM e KM acumulado) e trata KM/L como campo final opcional.

Para reconstruir e auditar os pacotes manualmente:

1. Atualize os três TXT na raiz do repositório.
2. Execute `node scripts/build_globus_data.js`.
3. Confira os arquivos gerados:
   - `dados/globus-1000-2999.json`
   - `dados/globus-200-300.json`
   - `dados/globus-500-699.json`
   - `dados/globus-importados.json`
4. Revise a proposta gerada antes de integrá-la à branch `main`.

O GitHub Actions também executa essa rotina quando um dos três TXT da raiz é atualizado, ou quando o fluxo é iniciado manualmente. Se houver dados ambíguos, campos numéricos inválidos ou períodos divergentes, a execução falha sem publicar os pacotes e apresenta a linha de origem para revisão. Quando os pacotes mudam, o fluxo abre um pull request para revisão.

## Regras de preservação dos dados

- Cada lançamento mantém o número da linha original e o nome do TXT de origem.
- KM, hodômetros e KM/L são extraídos do relatório sem completar dígitos por suposição.
- Quando o relatório não informa hodômetros ou KM, os campos permanecem `null`.
- Quando o relatório não informa KM/L, esse campo permanece `null`; o sistema não substitui o valor por um cálculo. O KM/L calculado pelo ATT ABA permanece em campo separado.
- A conferência de KM/L considera a precisão de duas casas decimais do TXT (tolerância de 0,0051), evitando classificar simples arredondamentos como divergência.
- Linhas sem combustível são preservadas separadamente em `linhasSemCombustivel`; não entram na contagem de abastecimentos nem na soma de litros. Isso mantém disponíveis registros de hodômetro/KM e outros produtos sem tratá-los como abastecimentos.
- O manifesto também registra linhas sem combustível com hodômetro, linhas com outros produtos, divergências entre hodômetro inicial/final e KM percorrido, divergências de KM/L acima da tolerância de arredondamento e campos KM/L ausentes.
- Os três TXT originais são preservados no repositório.
- O manifesto registra o período, os hashes dos TXT, a quantidade de lançamentos, as linhas candidatas sem combustível e os prefixos incluídos.
- Alterações no próprio importador também acionam a auditoria automática do GitHub Actions.

## Importação local pelo painel

O painel também oferece em **Auditoria** a opção **Pré-conferir relatório gerencial Globus (TXT)**. Essa função é independente da publicação dos pacotes do repositório: guarda os lotes no IndexedDB do navegador e mantém o TXT original junto com o histórico de aplicação e as pendências. Esses dados locais não são sincronizados automaticamente com outros navegadores ou dispositivos.

Antes de aplicar um lote local, confira o período, os prefixos, as linhas com divergências e os pares encontrados. Linhas ambíguas ou inválidas permanecem nas pendências para revisão.
