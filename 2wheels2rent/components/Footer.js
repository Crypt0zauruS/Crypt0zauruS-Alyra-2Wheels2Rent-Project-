import { useState, useEffect, useRef } from "react";

const Footer = ({ show }) => {
  const [modal, setModal] = useState(null);
  const modalRef = useRef(null);

  const handleClickOutside = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      setModal(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside, true);
    return () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, []);

  return (
    <div>
      <footer>
        <div style={{ color: "black" }}>
          &copy; 2Wheels2Rent - 2023 -{" "}
          <span
            onClick={() => {
              setModal(!modal);
            }}
            style={{ cursor: "pointer", color: "orangered" }}
          >
            Disclaimer
          </span>
          <p>
            Made with ❤️ &{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://vercel.com/docs/concepts/next.js/overview"
            >
              <span style={{ color: "orangered", cursor: "pointer" }}>
                {" "}
                Next.js
              </span>
            </a>{" "}
            by{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/Crypt0zauruS/"
            >
              <span style={{ color: "orangered", cursor: "pointer" }}>
                &copy; Crypt0zauruS - 2023{" "}
              </span>
            </a>
            <br />
            This Project is licensed under{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="http://creativecommons.org/licenses/by/4.0/"
            >
              {" "}
              <span style={{ color: "orangered", cursor: "pointer" }}>
                Creative Commons Attribution 4.0 International License (CC BY
                4.0)
              </span>
            </a>
          </p>
        </div>
      </footer>
      {modal && (
        <div
          className="modalContract"
          ref={modalRef}
          style={{ color: "black" }}
        >
          <p className="text-center">LEGAL DISCLAIMER</p>
          <hr />
          <p className=" fs-6" style={{ textAlign: "justify" }}>
            CLAUSE DE NON-RESPONSABILITÉ JURIDIQUE
            <br />
            <br />
            VEUILLEZ LIRE ATTENTIVEMENT L&apos;ENSEMBLE DE LA SECTION &quot;AVIS
            JURIDIQUE&quot;. RIEN DANS LE PRÉSENT DOCUMENT NE CONSTITUE UN
            CONSEIL JURIDIQUE, FINANCIER, COMMERCIAL OU FISCAL ET VOUS DEVEZ
            CONSULTER VOTRE PROPRE CONSEILLER JURIDIQUE, FINANCIER, FISCAL OU
            TOUT AUTRE CONSEILLER PROFESSIONNEL AVANT DE VOUS ENGAGER DANS TOUTE
            ACTIVITÉ EN RAPPORT AVEC CE MATÉRIEL. NI 2 WHEELS 2 RENT (LA
            SOCIÉTÉ), NI AUCUN DES MEMBRES DE L&apos;ÉQUIPE DU PROJET OU SUR LE
            PROJET DE DÉVELOPPEMENT 2 WHEELS 2 RENT DE QUELQUE MANIÈRE QUE CE
            SOIT, NI AUCUN DISTRIBUTEUR/VENDEUR DE JETONS $W2R (LE
            DISTRIBUTEUR), NI AUCUN FOURNISSEUR DE SERVICES NE SERA RESPONSABLE
            DE TOUT DOMMAGE DIRECT OU INDIRECT OU DE TOUTE PERTE QUE VOUS
            POURRIEZ SUBIR EN ACCÉDANT À CE LIVRE BLANC OU TOUT AUTRE SITE WEB
            OU MATÉRIEL PUBLIÉ PAR LA SOCIÉTÉ.
            <hr />
            Objectif du projet :<br />
            Vous acceptez d&apos;acheter $W2R pour participer à 2WHEELS 2 RENT
            et obtenir des services sur l&apos;écosystème associé. La Société,
            le Distributeur et leurs affiliés respectifs développeront et
            contribueront au code source sous-jacent de 2WHEELS 2 RENT. La
            Société agit uniquement en tant que tiers indépendant en ce qui
            concerne la distribution de $W2R, et non en tant que conseiller
            financier ou fiduciaire de toute personne en ce qui concerne la
            distribution de $W2R. <hr />
            Nature du livre blanc : <br />
            Le livre blanc et le site web sont destinés à des fins
            d&apos;information générale uniquement et ne constituent pas un
            prospectus, un document d&apos;offre, une offre de titres, une
            sollicitation d&apos;investissement ou une offre de vente d&apos;un
            produit, d&apos;un article ou d&apos;un actif (qu&apos;il soit
            numérique ou autre). Les informations contenues dans le présent
            document peuvent ne pas être complètes et n&apos;impliquent aucun
            élément de relation contractuelle. Il n&apos;y a aucune assurance
            quant à l&apos;exactitude ou à l&apos;exhaustivité de ces
            informations et aucune déclaration, garantie ou engagement
            n&apos;est donné ou n&apos;a l&apos;intention d&apos;être donné
            quant à l&apos;exactitude ou à l&apos;exhaustivité de ces
            informations. Lorsque le Livre Blanc ou le site Internet contient
            des informations provenant de sources tierces, la Société, le
            Distributeur, leurs filiales respectives et/ou l&apos;équipe de
            2WHEELS 2 RENT n&apos;ont pas vérifié de manière indépendante
            l&apos;exactitude ou l&apos;exhaustivité de ces informations. En
            outre, vous reconnaissez que les circonstances peuvent changer et
            que le Livre Blanc ou le site Internet peuvent devenir obsolètes de
            ce fait ; et ni la Société ni le Distributeur n&apos;ont
            d&apos;obligation de mettre à jour ou de corriger ce document à cet
            égard. <hr />
            Documentation sur les jetons : <br />
            Rien dans le Livre Blanc ou le Site Internet ne constitue une offre
            de vente de $W2R (tel que défini ici) de la part de la Société, du
            Distributeur ou de l&apos;équipe de 2WHEELS 2 RENT ni ne doit servir
            de base ou être invoqué en tout ou partie dans le cadre d&apos;un
            contrat ou d&apos;une décision d&apos;investissement. Rien de ce qui
            est contenu dans le Livre Blanc ou sur le site Internet n&apos;est
            ou ne peut être considéré comme une promesse, une représentation ou
            un engagement quant aux performances futures de 2 WHEELS 2 RENT .
            L&apos;accord entre le Distributeur (ou tout autre tiers) et vous
            concernant la distribution ou le transfert de $ W2R sera régi
            uniquement par les termes et conditions séparés de cet accord.{" "}
            <hr />
            Les informations présentées dans le livre blanc et sur le site Web
            sont destinées à la discussion communautaire uniquement et ne sont
            pas juridiquement contraignantes. Personne n&apos;est tenu de
            conclure un contrat contraignant ou un engagement légal en rapport
            avec l&apos;acquisition de $ W2R, et aucun actif numérique ou autre
            forme de paiement ne doit être accepté sur la base du Livre blanc ou
            du site web. L&apos;Accord de distribution de $ W2R et/ou la
            détention continue de $ W2R seront régis par un ensemble distinct de
            Conditions générales ou d&apos;Accord de distribution de jetons
            (selon le cas) définissant les conditions de cette distribution
            et/ou de la détention continue de $ W2R (les Conditions générales),
            qui vous seront fournies séparément ou qui seront disponibles sur le
            Site Internet. Les Conditions générales doivent être lues
            conjointement avec le Livre blanc. En cas d&apos;incohérence entre
            les Conditions générales et le Livre blanc ou le Site web, les
            Conditions générales prévaudront. <hr />
            Représentations et garanties présumées : <br />
            En accédant au Livre blanc ou au site Internet (ou à toute partie de
            ceux-ci), vous êtes réputé représenter et garantir à la Société, au
            Distributeur, à leurs affiliés respectifs et à l&apos;équipe 2
            WHEELS 2 RENT que :
            <br />
            <br />
            1.
            <br />
            Dans toute décision d&apos;achat d&apos;un $ W2R, vous ne devez pas
            vous baser sur une quelconque déclaration contenue dans le Livre
            Blanc ou le Site Internet ;
            <br />
            <br />
            2.
            <br />
            Vous devez vous conformer et vous vous conformerez, à vos propres
            frais, à toutes les lois, exigences réglementaires et restrictions
            applicables (le cas échéant) ;
            <br />
            <br />
            3.
            <br />
            Vous reconnaissez, comprenez et acceptez que le $ W2R peut
            n&apos;avoir aucune valeur, qu&apos;il n&apos;y a aucune garantie ou
            représentation de valeur ou de liquidité pour le $ W2R, et que le $
            W2R n&apos;est pas un produit d&apos;investissement et n&apos;est
            pas destiné à un investissement spéculatif de quelque nature que ce
            soit ;
            <br />
            <br />
            4.
            <br />
            Ni la Société, ni le Distributeur, ni leurs affiliés respectifs, ni
            les membres de l&apos;équipe 2 WHEELS 2 RENT ne sont responsables de
            la valeur des $W2R, de leur transférabilité et/ou de leur liquidité
            et/ou de l&apos;existence d&apos;un marché pour les $ W2R par
            l&apos;intermédiaire de tiers ou autrement ; et vous reconnaissez,
            comprenez et acceptez que vous ne pouvez pas participer à la
            distribution des $ W2R si vous êtes citoyen, ressortissant, résident
            (fiscal ou autre), domicilié et/ou détenteur d&apos;une carte verte
            d&apos;une zone géographique ou d&apos;un pays (i) où il est
            probable que la distribution des $ W2R soit interprétée comme la
            vente d&apos;une valeur mobilière (quelle qu&apos;en soit la
            dénomination), service financier ou produit d&apos;investissement
            et/ou (ii) où la participation aux distributions de jetons est
            interdite par la loi, le décret, le règlement, le traité ou
            l&apos;acte administratif applicable (y compris, sans limitation,
            les États-Unis d&apos;Amérique, le Canada et la République populaire
            de Chine) ; et à cet effet, vous acceptez de fournir tous ces
            documents de vérification d&apos;identité lorsqu&apos;ils sont
            demandés afin que les vérifications pertinentes puissent être
            effectuées. La Société, le Distributeur et l&apos;équipe de 2 WHEELS
            2 RENT ne font pas et ne prétendent pas faire, et rejettent par la
            présente, toute représentation, garantie ou engagement envers toute
            entité ou personne (y compris, sans limitation, les garanties quant
            à l&apos;exactitude, l&apos;exhaustivité, l&apos;actualité ou la
            fiabilité du contenu du livre blanc ou du site web, ou de tout autre
            matériel publié par la Société ou le Distributeur). Dans les limites
            autorisées par la loi, la Société, le Distributeur, leurs filiales
            respectives et leurs prestataires de services ne peuvent être tenus
            responsables des pertes indirectes, spéciales, accessoires,
            consécutives ou autres de quelque nature que ce soit, qu&apos;il
            s&apos;agisse d&apos;un délit, d&apos;un contrat ou autre (y
            compris, sans s&apos;y limiter, toute responsabilité découlant
            d&apos;un manquement ou d&apos;une négligence de la part de
            l&apos;un d&apos;entre eux, ou toute perte de revenus, de recettes
            ou de bénéfices, et toute perte d&apos;utilisation ou de données)
            résultant de l&apos;utilisation du Livre blanc ou du site Web, ou de
            tout autre document publié, ou de son contenu (y compris, sans
            s&apos;y limiter, toute erreur ou omission) ou de toute autre
            question liée à ces documents. Les acquéreurs potentiels de $ W2R
            doivent examiner et évaluer attentivement tous les risques et
            incertitudes (y compris les risques et incertitudes financiers et
            juridiques) associés à la distribution de $ W2R, à la Société, au
            Distributeur et à l&apos;équipe de WHEELS 2 RENT.
            <hr />
            Token $ W2R : <br />
            Les $ W2R sont conçus pour être utilisés, et c&apos;est
            l&apos;objectif de la distribution des $ W2R. En effet, le projet de
            développement de 2 WHEELS 2 RENT échouerait si tous les détenteurs
            de $ W2R se contentaient de conserver leurs $ W2R sans rien en
            faire. En particulier, il est souligné que le $ W2R: n&apos;a pas de
            manifestation tangible ou physique, et n&apos;a pas de valeur
            intrinsèque (et aucune personne ne fait de déclaration ou ne prend
            d&apos;engagement quant à sa valeur) ; n&apos;est pas remboursable
            et ne peut être échangé contre de l&apos;argent (ou sa valeur
            équivalente dans tout autre actif numérique) ou toute obligation de
            paiement de la part de la Société, du Distributeur ou de l&apos;un
            de leurs affiliés respectifs ; ne représente ni ne confère au
            détenteur du jeton aucun droit de quelque forme que ce soit à
            l&apos;égard de la Société, du Distributeur (ou de l&apos;une de
            leurs sociétés affiliées respectives), ou de ses revenus ou actifs,
            y compris, sans limitation, tout droit de recevoir des dividendes
            futurs, des revenus, des actions, un droit de propriété ou une
            participation, une action ou un titre, tout droit de vote, de
            distribution, de rachat, de liquidation, de propriété (y compris
            toutes les formes de droits de propriété intellectuelle ou de
            licence), le droit de recevoir des comptes, des états financiers ou
            d&apos;autres données financières, le droit de demander ou de
            participer à des assemblées d&apos;actionnaires, le droit de nommer
            un administrateur, ou d&apos;autres droits financiers ou juridiques
            ou des droits équivalents, ou des droits de propriété intellectuelle
            ou toute autre forme de participation dans 2 WHEELS 2 RENT, la
            Société, le Distributeur et/ou leurs fournisseurs de services ou en
            rapport avec ces derniers ; n&apos;est pas destiné à représenter des
            droits dans le cadre d&apos;un contrat de différence ou de tout
            autre contrat dont l&apos;objectif, réel ou supposé, est
            d&apos;assurer un profit ou d&apos;éviter une perte ; n&apos;est pas
            destiné à représenter de l&apos;argent (y compris de l&apos;argent
            électronique), un titre, une marchandise, une obligation, un titre
            de créance, une part dans un organisme de placement collectif ou
            tout autre type d&apos;instrument financier ou d&apos;investissement
            ; n&apos;est pas un prêt à la Société, au Distributeur ou à
            l&apos;un de leurs affiliés respectifs, n&apos;est pas destiné à
            représenter une dette de la Société, du Distributeur ou de l&apos;un
            de leurs affiliés respectifs, et il n&apos;y a pas d&apos;attente de
            profit ; et ne confère au détenteur du jeton aucun droit de
            propriété ou autre intérêt dans la Société, le Distributeur ou
            l&apos;une de leurs sociétés affiliées respectives.
            <hr />
            Nonobstant la distribution du $ W2R, les utilisateurs n&apos;ont
            aucun droit économique ou légal sur les actifs de la Société, du
            Distributeur ou de l&apos;une de leurs sociétés affiliées après la
            distribution du jeton, ni aucun intérêt bénéficiaire dans ces
            actifs. <hr />
            Dans la mesure où un marché secondaire ou une bourse d&apos;échange
            de $W2R se développe, il sera géré et exploité de manière totalement
            indépendante de la Société, du Distributeur, de la distribution de $
            W2R et de WHEELS 2 RENT. Ni la Société ni le Distributeur ne
            créeront de tels marchés secondaires et aucune de ces entités
            n&apos;agira en tant qu&apos;échange de $ W2R. <hr />
            A des fins d&apos;information uniquement : <br />
            Les informations présentées ici sont uniquement conceptuelles et
            décrivent les futurs objectifs de développement de WHEELS 2 RENT. En
            particulier, la feuille de route du projet dans le livre blanc est
            partagée afin de souligner certains des plans de l&apos;équipe
            WHEELS 2 RENT, et est fournie uniquement à des FINS
            D&apos;INFORMATION et ne constitue pas un engagement contraignant.
            Ne vous fiez pas à ces informations pour décider de participer ou
            non à la distribution de jetons car, en fin de compte, le
            développement, la sortie et le calendrier de tout produit,
            caractéristique ou fonctionnalité restent à la seule discrétion de
            la Société, du Distributeur ou de leurs affiliés respectifs, et sont
            susceptibles de changer. En outre, le Livre blanc ou le site Web
            peuvent être modifiés ou remplacés de temps à autre. Il n&apos;y a
            aucune obligation de mettre à jour le livre blanc ou le site web, ou
            de fournir aux destinataires l&apos;accès à des informations autres
            que celles fournies dans le présent document.
            <hr />
            Approbation réglementaire : <br />
            Aucune autorité réglementaire n&apos;a examiné ou approuvé, de
            manière formelle ou informelle, les informations contenues dans le
            livre blanc ou sur le site web. Aucune action ou assurance de ce
            type n&apos;a été ou ne sera prise en vertu des lois, des exigences
            réglementaires ou des règles d&apos;une quelconque juridiction. La
            publication, la distribution ou la diffusion du livre blanc ou du
            site web n&apos;implique pas que les lois, les exigences
            réglementaires ou les règles applicables ont été respectées.
            <hr />
            Avertissement sur les déclarations prospectives :<br />
            Toutes les déclarations contenues dans le présent document, les
            déclarations faites dans les communiqués de presse ou dans tout
            autre lieu accessible au public et les déclarations orales qui
            peuvent être faites par la Société, le Distributeur et/ou
            l&apos;équipe WHEELS 2 RENT, peuvent constituer des déclarations
            prospectives (y compris les déclarations concernant
            l&apos;intention, la conviction ou les attentes actuelles concernant
            les conditions du marché, la stratégie et les plans d&apos;affaires,
            la situation financière, les dispositions spécifiques et les
            pratiques de gestion des risques). Nous vous conseillons de ne pas
            accorder une confiance excessive à ces déclarations prospectives,
            car elles impliquent des risques connus et inconnus, des
            incertitudes et d&apos;autres facteurs susceptibles d&apos;entraîner
            des résultats futurs sensiblement différents de ceux décrits dans
            ces déclarations prospectives, et aucun tiers indépendant n&apos;a
            vérifié le bien-fondé de ces déclarations ou de ces hypothèses. Ces
            déclarations prospectives ne sont applicables qu&apos;à partir de la
            date indiquée dans le Livre blanc, et la Société, le Distributeur
            ainsi que l&apos;équipe de 2 WHEELS 2 RENT déclinent expressément
            toute responsabilité (expresse ou implicite) de publier des
            révisions de ces déclarations prospectives pour refléter des
            événements postérieurs à cette date.
            <hr />
            Références aux entreprises et aux plateformes : <br />
            L&apos;utilisation de noms de sociétés et/ou de plateformes ou de
            marques commerciales dans le présent document (à l&apos;exception de
            ceux qui se rapportent à la Société, au Distributeur ou à leurs
            filiales respectives) n&apos;implique aucune affiliation avec une
            tierce partie ni aucune approbation de sa part. Les références à des
            entreprises et à des plateformes spécifiques dans le livre blanc ou
            sur le site web sont uniquement fournies à titre d&apos;exemple.
            <hr />
            Langue anglaise : <br />
            Le livre blanc et le site web peuvent être traduits dans une langue
            autre que l&apos;anglais à titre de référence uniquement et, en cas
            de conflit ou d&apos;ambiguïté entre la version anglaise et les
            versions traduites du livre blanc ou du site web, les versions
            anglaises prévaudront. Vous reconnaissez avoir lu et compris la
            version anglaise du livre blanc et du site web.
            <hr />
            Pas de distribution : <br />
            Aucune partie du livre blanc ou du site web ne peut être copiée,
            reproduite, distribuée ou diffusée de quelque manière que ce soit
            sans l&apos;accord écrit préalable de la Société ou du Distributeur.
            En assistant à une présentation sur ce livre blanc ou en acceptant
            une copie papier ou électronique du livre blanc, vous acceptez
            d&apos;être lié par les limitations susmentionnées.
          </p>
          <button
            type="button"
            className="submit btn btn-danger"
            onClick={() => setModal(false)}
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};

export default Footer;
