import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const WHATSAPP_CORRETORA = "559293584432";
const STORAGE_BUCKET = "imoveis-fotos";
const SIGNED_IMAGE_TTL_SECONDS = 300;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});

const propertyGrid = document.querySelector("#imoveis-grid");
const filterButtons = document.querySelectorAll("[data-filter]");
let properties = [];
let currentFilter = "todos";

document.querySelector("#ano-atual").textContent = String(new Date().getFullYear());

document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
  link.href = `https://wa.me/${WHATSAPP_CORRETORA}`;
});

function setPanelState(button, panel, isOpen) {
  button.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    panel.hidden = false;
    panel.style.maxHeight = "0px";
    requestAnimationFrame(() => {
      panel.classList.add("is-open");
      panel.style.maxHeight = `${panel.scrollHeight}px`;
    });
    return;
  }

  panel.style.maxHeight = `${panel.scrollHeight}px`;
  panel.getBoundingClientRect();
  panel.classList.remove("is-open");
  panel.style.maxHeight = "0px";
}

document.querySelectorAll("[data-accordion]").forEach((button) => {
  const panel = document.getElementById(button.dataset.accordion);

  panel.addEventListener("transitionend", (event) => {
    if (event.propertyName !== "max-height") return;
    if (button.getAttribute("aria-expanded") === "true") {
      panel.style.maxHeight = "none";
    } else {
      panel.hidden = true;
    }
  });

  button.addEventListener("click", () => {
    const shouldOpen = button.getAttribute("aria-expanded") !== "true";

    document.querySelectorAll("[data-accordion]").forEach((otherButton) => {
      const otherPanel = document.getElementById(otherButton.dataset.accordion);
      if (otherButton !== button && otherButton.getAttribute("aria-expanded") === "true") {
        setPanelState(otherButton, otherPanel, false);
      }
    });

    setPanelState(button, panel, shouldOpen);
  });
});

function showWhatsAppFallback(status, url) {
  status.replaceChildren();
  status.hidden = false;
  status.append("Se a nova aba não abrir, ");

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "toque aqui para continuar pelo WhatsApp";
  status.append(link, ".");
}

function handleLeadFormSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const values = Object.fromEntries(new FormData(form).entries());
  const message = form.dataset.form === "comprador"
    ? [
        "Olá, Joice! Quero encontrar um imóvel.",
        `Nome: ${values.nome}`,
        `Meu WhatsApp: ${values.whatsapp}`,
        `Finalidade: ${values.finalidade}`,
        `Tipo de imóvel: ${values.tipo}`,
        `Bairro de preferência: ${values.bairro}`,
        `Faixa de valor: ${values.valor}`
      ].join("\n")
    : [
        "Olá, Joice! Quero anunciar um imóvel.",
        `Nome: ${values.nome}`,
        `Meu WhatsApp: ${values.whatsapp}`,
        `Negócio: ${values.negocio}`,
        `Tipo de imóvel: ${values.tipo}`,
        `Localização: ${values.localizacao}`,
        `Descrição: ${values.descricao}`
      ].join("\n");
  const url = `https://wa.me/${WHATSAPP_CORRETORA}?text=${encodeURIComponent(message)}`;
  const status = form.querySelector("[data-form-status]");

  window.open(url, "_blank", "noopener,noreferrer");
  showWhatsAppFallback(status, url);
}

document.querySelectorAll("[data-form]").forEach((form) => {
  form.addEventListener("submit", handleLeadFormSubmit);
});

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createPropertyCard(property) {
  const card = makeElement("article", "property-card");
  const gallery = makeElement("div", "property-gallery");
  const imageButton = makeElement("button", "property-image-button");
  imageButton.type = "button";
  const image = makeElement("img", "property-image");
  image.loading = "lazy";
  image.decoding = "async";
  imageButton.append(image);

  const galleryCount = makeElement("span", "gallery-count");
  let selectedPhoto = 0;
  const showPhoto = () => {
    const photo = property.fotos[selectedPhoto];
    image.src = photo.src;
    image.alt = photo.alt || property.titulo;
    galleryCount.textContent = `${selectedPhoto + 1} / ${property.fotos.length}`;
    imageButton.setAttribute(
      "aria-label",
      `Ampliar foto ${selectedPhoto + 1} de ${property.fotos.length} de ${property.titulo}`
    );
  };
  const openLightbox = () => {
    const photo = property.fotos[selectedPhoto];
    const lightbox = document.querySelector("#image-lightbox");
    const lightboxImage = document.querySelector("#lightbox-image");
    lightboxImage.src = photo.src;
    lightboxImage.alt = photo.alt || property.titulo;
    document.querySelector("#lightbox-caption").textContent =
      `${property.titulo} · Foto ${selectedPhoto + 1} de ${property.fotos.length}`;
    lightbox.showModal();
  };
  imageButton.addEventListener("click", openLightbox);
  showPhoto();
  gallery.append(imageButton);

  if (property.fotos.length > 1) {
    const previous = makeElement("button", "gallery-control gallery-control-previous", "‹");
    previous.type = "button";
    previous.setAttribute("aria-label", "Foto anterior");
    previous.addEventListener("click", () => {
      selectedPhoto = (selectedPhoto - 1 + property.fotos.length) % property.fotos.length;
      showPhoto();
    });

    const next = makeElement("button", "gallery-control gallery-control-next", "›");
    next.type = "button";
    next.setAttribute("aria-label", "Próxima foto");
    next.addEventListener("click", () => {
      selectedPhoto = (selectedPhoto + 1) % property.fotos.length;
      showPhoto();
    });
    gallery.append(previous, next);
  }
  if (property.fotos.length > 1) gallery.append(galleryCount);

  const content = makeElement("div", "p-5");
  const badge = makeElement(
    "span",
    "inline-flex rounded-full bg-sand px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest",
    property.finalidade === "comprar" ? "Venda" : "Aluguel"
  );
  const title = makeElement("h3", "mt-3 font-display text-xl leading-snug text-forest", property.titulo);
  const location = makeElement("p", "mt-1 text-sm text-slate-500", `${property.tipo} · ${property.bairro}`);
  const price = makeElement(
    "p",
    "mt-4 text-xl font-bold text-forest",
    `${currencyFormatter.format(property.preco)}${property.finalidade === "alugar" ? " / mês" : ""}`
  );
  const features = [];
  if (property.quartos > 0) features.push(`${property.quartos} quartos`);
  features.push(`${property.vagas} ${property.vagas === 1 ? "vaga" : "vagas"}`);
  features.push(`${property.area} m²`);
  const details = makeElement("p", "mt-2 text-sm text-slate-500", features.join(" · "));
  const interest = makeElement(
    "a",
    "mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-forest-light",
    "Tenho interesse"
  );
  const message = `Olá, Joice! Tenho interesse no imóvel ${property.codigo} — ${property.titulo}.`;
  interest.href = `https://wa.me/${WHATSAPP_CORRETORA}?text=${encodeURIComponent(message)}`;
  interest.target = "_blank";
  interest.rel = "noopener noreferrer";

  content.append(badge, title, location, price, details, interest);
  card.append(gallery, content);
  return card;
}

const imageLightbox = document.querySelector("#image-lightbox");
imageLightbox.addEventListener("click", (event) => {
  if (event.target === imageLightbox) imageLightbox.close();
});
imageLightbox.addEventListener("close", () => {
  const lightboxImage = document.querySelector("#lightbox-image");
  lightboxImage.removeAttribute("src");
});
document.querySelector(".lightbox-close").addEventListener("click", () => imageLightbox.close());

function renderProperties() {
  const visibleProperties = properties.filter((property) => (
    currentFilter === "todos" || property.finalidade === currentFilter
  ));

  propertyGrid.replaceChildren();
  if (visibleProperties.length === 0) {
    propertyGrid.append(makeElement("p", "col-span-full rounded-xl bg-sand p-6 text-center text-sm text-slate-600", "Nenhum imóvel encontrado para este filtro."));
    return;
  }

  visibleProperties.forEach((property) => propertyGrid.append(createPropertyCard(property)));
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.setAttribute("aria-pressed", String(isActive));
      filterButton.className = isActive
        ? "filter-button min-h-11 rounded-full bg-forest px-5 text-sm font-semibold text-white"
        : "filter-button min-h-11 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-forest";
    });
    renderProperties();
  });
});

function isValidProperty(property) {
  return property
    && typeof property.codigo === "string"
    && ["comprar", "alugar"].includes(property.finalidade)
    && typeof property.tipo === "string"
    && typeof property.titulo === "string"
    && typeof property.bairro === "string"
    && Number.isFinite(property.preco)
    && Number.isFinite(property.quartos)
    && Number.isFinite(property.vagas)
    && Number.isFinite(property.area)
    && Array.isArray(property.fotos)
    && property.fotos.length > 0
    && property.fotos.every((photo) => (
      typeof photo.src === "string"
      && typeof photo.alt === "string"
    ));
}

async function loadProperties() {
  try {
    if (!supabase) {
      throw new Error("Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/supabase-config.js.");
    }

    const { data, error } = await supabase
      .from("properties")
      .select("id, code, finalidade, tipo, titulo, bairro, preco, quartos, vagas, area, property_images(id, storage_path, external_url, alt, sort_order)")
      .eq("status", "disponivel")
      .eq("publicado", true)
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "property_images", ascending: true });

    if (error) {
      throw error;
    }
    if (!Array.isArray(data)) {
      throw new Error("O Supabase retornou uma lista de imóveis inválida.");
    }

    properties = await Promise.all(data.map(async (row) => {
      if (!Array.isArray(row.property_images) || row.property_images.length === 0) {
        throw new Error(`O imóvel ${row.code} não possui fotos cadastradas.`);
      }

      const fotos = await Promise.all(row.property_images.map(async (photo) => {
        let src = photo.external_url;
        if (photo.storage_path) {
          const { data: signedImage, error: imageError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(photo.storage_path, SIGNED_IMAGE_TTL_SECONDS);
          if (imageError) throw imageError;
          src = signedImage.signedUrl;
        }
        return { src, alt: photo.alt };
      }));

      return {
        codigo: row.code,
        finalidade: row.finalidade,
        tipo: row.tipo,
        titulo: row.titulo,
        bairro: row.bairro,
        preco: Number(row.preco),
        quartos: row.quartos,
        vagas: row.vagas,
        area: Number(row.area),
        fotos
      };
    }));

    if (!properties.every(isValidProperty)) {
      throw new Error("Os dados retornados pelo Supabase estão incompletos ou em formato inválido.");
    }

    renderProperties();
  } catch (error) {
    console.error("Erro ao carregar a vitrine de imóveis:", error);
    propertyGrid.replaceChildren(
      makeElement(
        "p",
        "col-span-full rounded-xl bg-amber-50 p-6 text-center text-sm text-amber-900",
        isSupabaseConfigured
          ? "Não foi possível carregar os imóveis agora. Tente novamente mais tarde ou fale com a corretora."
          : "A vitrine de imóveis ainda está sendo conectada. Volte em breve."
      )
    );
  }
}

loadProperties();
