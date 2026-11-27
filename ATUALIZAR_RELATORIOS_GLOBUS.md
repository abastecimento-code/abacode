# Atualizar os relatórios gerenciais Globus

Os três relatórios oficiais usados pelo painel ficam na raiz do repositório:

- `1000-2999.TXT`
- `200-300.TXT`
- `500-699.TXT`

Os três arquivos devem corresponder ao mesmo período. O importador lê o intervalo diretamente do cabeçalho de cada TXT e interrompe a geração se os períodos forem diferentes ou se houver linha fora do intervalo declarado.

## Reconstrução dos pacotes publicados

O parser oficial está em `scripts/build_globus_data.js`. Ele lê combustível e demais produtos por suas posições fixas e extrai cada campo do rodapé (hodômetros, KM, KM acumulado e KM/L) em sua própria coluna. A extração não compacta números: se um campo estiver ausente, os campos seguintes mantêm suas posições e a ausência permanece `null`.

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
- Quando o relatório não informa KM/L, esse campo permanece `null`; o sistema não substitui o valor por um cálculo.
- Linhas sem combustível não entram na contagem de abastecimentos nem na soma de litros.
- Os três TXT originais são preservados no repositório.
- O manifesto registra o período, os hashes dos TXT, a quantidade de lançamentos, as linhas candidatas sem combustível e os prefixos incluídos.
- Alterações no próprio importador também acionam a auditoria automática do GitHub Actions.

## Importação local pelo painel

O painel também oferece em **Auditoria** a opção **Pré-conferir relatório gerencial Globus (TXT)**. Essa função é independente da publicação dos pacotes do repositório: guarda os lotes no IndexedDB do navegador e mantém o TXT original junto com o histórico de aplicação e as pendências. Esses dados locais não são sincronizados automaticamente com outros navegadores ou dispositivos.

Antes de aplicar um lote local, confira o período, os prefixos, as linhas com divergências e os pares encontrados. Linhas ambíguas ou inválidas permanecem nas pendências para revisão.
