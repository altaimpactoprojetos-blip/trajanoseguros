/* ==========================================================================
   Trajano Seguros — dados oficiais do site
   Preencha somente com informações confirmadas pela empresa.
   Campo vazio ("") = o item correspondente fica escondido no site.
   ========================================================================== */
window.TRAJANO = {
  // Contato comercial
  whatsapp: "",            // DDI + DDD + número, só dígitos. Ex.: "5585999999999"
  telefoneExibicao: "",    // Como o número aparece no site. Ex.: "(85) 9 9999-9999"
  email: "",               // E-mail comercial e para pedidos sobre dados pessoais (LGPD)
  instagram: "",           // Só o usuário, sem @. Ex.: "trajanoseguros"
  horario: "",             // Ex.: "Segunda a sexta, das 8h às 18h"

  // Dados cadastrais
  razaoSocial: "",         // Nome empresarial que consta no CNPJ
  cnpj: "61.814.373/0001-90", // Ex.: "00.000.000/0001-00"
  endereco: "",            // Endereço comercial completo
  susep: "251172774",      // Número de registro do corretor/corretora na SUSEP

  // Backend das cotações (Supabase — projeto CRM Vitalício).
  // A chave abaixo é PÚBLICA (publishable): só permite chamar a função de cotação.
  supabaseUrl: "https://lffzxqwgqgsiumunahyt.supabase.co",
  supabaseKey: "sb_publishable_ckFnucj9hoCwIbdX9HMC_A_XT006uDI",

  // Versão do Aviso de Privacidade (mude ao alterar privacidade.html)
  avisoPrivacidadeVersao: "2026-10-20"
};
