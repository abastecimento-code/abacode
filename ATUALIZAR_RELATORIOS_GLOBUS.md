# Atualizar relatórios Globus sem usar créditos de IA

Use o importador do próprio dashboard para relatórios de prefixos já cadastrados. Ele lê o TXT no navegador, compara os lançamentos com a base e permite guardar somente os novos registros sem divergências. Não é necessário enviar o relatório ao ChatGPT nem pedir uma edição do HTML para cada arquivo.

## Caminho

1. Abra <https://abastecimento-code.github.io/abacode/> no mesmo navegador e perfil em que pretende consultar os dados.
2. Abra **Auditoria** e, em **Pré-conferir relatório gerencial Globus (TXT)**, selecione o relatório.
3. Confira o período, prefixos, linhas com divergências e os pares encontrados.
4. Se a prévia estiver correta, clique em **Guardar arquivo e aplicar somente lançamentos novos não ambíguos**. Linhas ambíguas ou inválidas permanecem nas pendências para revisão.
5. Em **Auditoria**, use **Baixar backup dos lotes** para salvar uma cópia. Para recuperar os dados em outro navegador, use **Restaurar backup**.

## Onde os dados ficam

Os TXT e lançamentos aceitos ficam no IndexedDB do navegador atual. O arquivo original é guardado junto com o histórico de aplicação e as pendências. O conteúdo não é enviado ao servidor pelo importador; a prévia e os cálculos são feitos no navegador.

Essa atualização vale para esse navegador e perfil. Ela não altera o `index.html` publicado e não sincroniza os dados com outros usuários ou dispositivos. Para compartilhar uma nova base com todos, é necessária uma atualização/publicação do HTML. Um prefixo que ainda não esteja cadastrado precisa ser incluído no cadastro do dashboard antes que seus lançamentos possam ser aplicados.

O dashboard é analisado até **29/10/2026, inclusive**. Isso vale para a tabela principal, indicadores, suspeitas, evolução e relatório gerencial. Linhas posteriores permanecem preservadas no TXT original e nos lotes/backups, mas ficam fora de todos os cálculos analíticos até que uma nova data de referência seja definida no HTML.
