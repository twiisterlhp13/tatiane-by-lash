import { LegalPage } from "../legal-page";

export const metadata = { title: "Termos de uso" };

export default function Page() {
  return (
    <LegalPage title="Termos de uso" updated="25 de novembro de 2026">
      <p>Estes termos regem o uso da plataforma de agendamento online, utilizada pelos estabelecimentos (&quot;negócio&quot;) para organizar sua agenda e pelas clientes para marcar horários.</p>
      <h2>1. O que a plataforma faz</h2>
      <p>A plataforma intermedeia o agendamento entre a cliente e o negócio: exibe serviços, preços e horários livres informados pelo negócio e registra os agendamentos. O atendimento, os valores cobrados e a qualidade do serviço são de responsabilidade exclusiva do negócio.</p>
      <h2>2. Agendamentos</h2>
      <ul>
        <li>Ao confirmar um agendamento, a cliente declara que os dados informados são verdadeiros.</li>
        <li>O horário pode ficar &quot;aguardando confirmação&quot; quando o negócio optar por aprovar cada pedido.</li>
        <li>Cancelamentos e reagendamentos seguem a política exibida na página do negócio. Fora do prazo, a alteração deve ser combinada diretamente com o negócio.</li>
        <li>O negócio pode cancelar ou remarcar um agendamento por motivo de força maior, avisando a cliente.</li>
      </ul>
      <h2>3. Conta do negócio</h2>
      <ul>
        <li>O negócio é responsável pelo acesso de sua equipe, pela veracidade das informações publicadas e pelo cumprimento da legislação aplicável à sua atividade, inclusive a LGPD em relação aos dados de suas clientes.</li>
        <li>É proibido usar a plataforma para fins ilícitos, envio de mensagens não solicitadas ou coleta de dados sem base legal.</li>
      </ul>
      <h2>4. Disponibilidade</h2>
      <p>Trabalhamos para manter o serviço disponível, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. Recomendamos que o negócio mantenha canais alternativos de contato.</p>
      <h2>5. Contato</h2>
      <p>Dúvidas sobre um agendamento devem ser tratadas diretamente com o negócio pelos contatos exibidos em sua página.</p>
    </LegalPage>
  );
}
