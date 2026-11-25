import { LegalPage } from "../legal-page";

export const metadata = { title: "Política de privacidade" };

export default function Page() {
  return (
    <LegalPage title="Política de privacidade" updated="25 de novembro de 2026">
      <p>Esta política explica como os dados pessoais são tratados na plataforma de agendamento, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      <h2>Quem é responsável</h2>
      <p>O estabelecimento em que você agenda é o <strong>controlador</strong> dos seus dados. A plataforma atua como <strong>operadora</strong>, tratando os dados apenas para viabilizar o agendamento e conforme as instruções do estabelecimento.</p>
      <h2>Quais dados coletamos</h2>
      <ul>
        <li>Nome, telefone/WhatsApp e, se informado, e-mail;</li>
        <li>Dados do agendamento: serviço, profissional, data, horário, observações que você escrever e histórico de alterações;</li>
        <li>Registros técnicos mínimos de segurança (como data e hora de ações).</li>
      </ul>
      <h2>Para que usamos</h2>
      <ul>
        <li>Registrar, confirmar, lembrar, alterar e cancelar seus agendamentos (execução do serviço solicitado por você);</li>
        <li>Permitir que o estabelecimento entre em contato sobre o seu atendimento;</li>
        <li>Enviar novidades e promoções <strong>somente</strong> se você marcar essa opção, que é separada do agendamento e pode ser retirada a qualquer momento.</li>
      </ul>
      <h2>Compartilhamento</h2>
      <p>Seus dados são vistos pelo estabelecimento e por sua equipe autorizada. Usamos provedores de infraestrutura (hospedagem, banco de dados e envio de e-mails) que tratam os dados apenas para prestar esses serviços. Não vendemos dados pessoais.</p>
      <h2>Por quanto tempo</h2>
      <p>Os dados são mantidos enquanto houver relação com o estabelecimento ou pelo prazo necessário para cumprir obrigações legais. Depois disso, são excluídos ou anonimizados.</p>
      <h2>Seus direitos</h2>
      <p>Você pode pedir ao estabelecimento acesso, correção, portabilidade ou exclusão dos seus dados e revogar consentimentos. O estabelecimento consegue exportar seus dados e anonimizar seu cadastro diretamente pela plataforma.</p>
      <h2>Segurança</h2>
      <p>Usamos conexão criptografada, senhas protegidas por hash, links de gestão individuais e controle de acesso por função. Nenhum dado de cartão é armazenado.</p>
      <h2>Dados sensíveis</h2>
      <p>Evite informar dados de saúde nas observações, a menos que o estabelecimento solicite para a sua segurança no atendimento. Nesse caso, eles são usados apenas para esse fim.</p>
    </LegalPage>
  );
}
