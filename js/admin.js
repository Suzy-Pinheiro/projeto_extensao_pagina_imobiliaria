import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const STORAGE_BUCKET = "imoveis-fotos";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PROPERTY_IMAGES = 15;
const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const propertyStatusLabels = {
  disponivel: "Disponível",
  alugado: "Alugado",
  vendido: "Vendido",
  rascunho: "Rascunho"
};
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const configNotice = document.querySelector("#config-notice");
const loginSection = document.querySelector("#login-section");
const dashboardSection = document.querySelector("#dashboard-section");
const loginStatus = document.querySelector("#login-status");
const adminStatus = document.querySelector("#admin-status");
const loginForm = document.querySelector("#login-form");
const propertyForm = document.querySelector("#property-form");
const editorSection = document.querySelector("#editor-section");
const propertyList = document.querySelector("#property-list");
const imageInput = propertyForm.elements.imagens;
const photoEditorList = document.querySelector("#photo-editor-list");
const photoCount = document.querySelector("#photo-count");
let properties = [];
let currentPhotos = [];
let pendingImageFiles = [];
const pendingImageUrls = new Map();

function showStatus(target, message, isError = false) {
  target.textContent = message;
  target.classList.toggle("text-red-700", isError);
  target.classList.toggle("text-slate-700", !isError);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setEditorOpen(isOpen) {
  editorSection.hidden = !isOpen;
  if (!isOpen) {
    propertyForm.reset();
    propertyForm.elements.id.value = "";
    propertyForm.elements.quartos.value = "0";
    propertyForm.elements.vagas.value = "0";
    document.querySelector("#editor-title").textContent = "Adicionar imóvel";
    document.querySelector("#save-property-button").textContent = "Salvar imóvel e fotos";
    document.querySelector("#image-help").textContent = "Até 15 fotos por imóvel; cada arquivo pode ter até 10 MB.";
    clearPhotoEditor();
  }
}

function clearPhotoEditor() {
  pendingImageUrls.forEach((url) => URL.revokeObjectURL(url));
  pendingImageUrls.clear();
  currentPhotos = [];
  pendingImageFiles = [];
  imageInput.value = "";
  photoEditorList.replaceChildren();
  photoCount.textContent = "";
}

function renderPhotoEditor() {
  photoEditorList.replaceChildren();

  currentPhotos.forEach((photo) => {
    const item = makeElement("div", "admin-photo-item");
    const image = makeElement("img");
    image.src = photo.displayImageUrl || photo.external_url || "";
    image.alt = photo.alt || "Foto atual do imóvel";
    const removeButton = makeElement(
      "button",
      "mt-2 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-700",
      "Remover"
    );
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      currentPhotos = currentPhotos.filter((currentPhoto) => currentPhoto.id !== photo.id);
      renderPhotoEditor();
    });
    item.append(image, removeButton);
    photoEditorList.append(item);
  });

  pendingImageFiles.forEach((file) => {
    if (!pendingImageUrls.has(file)) {
      pendingImageUrls.set(file, URL.createObjectURL(file));
    }

    const item = makeElement("div", "admin-photo-item");
    const image = makeElement("img");
    image.src = pendingImageUrls.get(file);
    image.alt = `Prévia da nova foto ${file.name}`;
    const removeButton = makeElement(
      "button",
      "mt-2 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-700",
      "Remover"
    );
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      URL.revokeObjectURL(pendingImageUrls.get(file));
      pendingImageUrls.delete(file);
      pendingImageFiles = pendingImageFiles.filter((pendingFile) => pendingFile !== file);
      renderPhotoEditor();
    });
    item.append(image, removeButton);
    photoEditorList.append(item);
  });

  const total = currentPhotos.length + pendingImageFiles.length;
  photoCount.textContent = `${total} de ${MAX_PROPERTY_IMAGES} fotos selecionadas`;
}

function getPropertyImageUrl(property) {
  if (property.external_url) return Promise.resolve(property.external_url);
  if (!property.storage_path) return Promise.resolve("");

  return supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(property.storage_path, 300)
    .then(({ data, error }) => {
      if (error) throw error;
      return data.signedUrl;
    });
}

function renderProperties() {
  propertyList.replaceChildren();

  if (properties.length === 0) {
    propertyList.append(makeElement(
      "p",
      "rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600",
      "Nenhum imóvel cadastrado ainda. Use “Novo imóvel” para começar."
    ));
    return;
  }

  properties.forEach((property) => {
    const card = makeElement("article", "admin-property-card");
    const row = makeElement("div", "flex flex-col gap-4 sm:flex-row sm:items-center");
    const image = makeElement("img", "admin-property-photo");
    image.alt = property.fotos[0]?.alt || `Foto do imóvel ${property.code}`;
    image.loading = "lazy";
    if (property.fotos[0]?.displayImageUrl) image.src = property.fotos[0].displayImageUrl;
    else image.hidden = true;

    const details = makeElement("div", "min-w-0 flex-1");
    const title = makeElement("h3", "font-semibold text-forest", property.titulo);
    const description = makeElement(
      "p",
      "mt-1 text-sm text-slate-600",
      `${property.code} · ${property.bairro} · ${property.finalidade === "comprar" ? "Venda" : "Aluguel"}`
    );
    const status = makeElement(
      "p",
      "mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500",
      `${propertyStatusLabels[property.status] || "Status desconhecido"} · ${
        property.status === "disponivel" && property.publicado ? "na vitrine" : "não publicada"
      }`
    );
    const editButton = makeElement(
      "button",
      "min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-forest",
      "Editar"
    );
    editButton.type = "button";
    editButton.addEventListener("click", () => editProperty(property));

    details.append(title, description, status);
    row.append(image, details, editButton);
    card.append(row);
    propertyList.append(card);
  });
}

function confirmDiscardEditor() {
  return editorSection.hidden || window.confirm("Descartar as alterações ainda não salvas?");
}

async function loadProperties() {
  showStatus(adminStatus, "Carregando imóveis...");
  const { data, error } = await supabase
    .from("properties")
    .select("id, code, finalidade, tipo, titulo, bairro, preco, quartos, vagas, area, status, publicado, property_images(id, property_id, storage_path, external_url, alt, sort_order)")
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "property_images", ascending: true });

  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("O Supabase retornou uma lista inválida.");

  properties = await Promise.all(data.map(async (property) => {
    const images = Array.isArray(property.property_images) ? property.property_images : [];
    const fotos = await Promise.all(images.map(async (photo) => {
      try {
        return { ...photo, displayImageUrl: await getPropertyImageUrl(photo) };
      } catch (imageError) {
        console.error(`Não foi possível gerar a prévia de uma foto do imóvel ${property.code}:`, imageError);
        return { ...photo, displayImageUrl: "" };
      }
    }));
    return { ...property, fotos };
  }));
  renderProperties();
  showStatus(adminStatus, `${properties.length} ${properties.length === 1 ? "imóvel cadastrado" : "imóveis cadastrados"}.`);
}

function editProperty(property) {
  if (!confirmDiscardEditor()) return;

  propertyForm.elements.id.value = property.id;
  propertyForm.elements.code.value = property.code;
  propertyForm.elements.titulo.value = property.titulo;
  propertyForm.elements.finalidade.value = property.finalidade;
  propertyForm.elements.tipo.value = property.tipo;
  propertyForm.elements.bairro.value = property.bairro;
  propertyForm.elements.preco.value = property.preco;
  propertyForm.elements.quartos.value = property.quartos;
  propertyForm.elements.vagas.value = property.vagas;
  propertyForm.elements.area.value = property.area;
  propertyForm.elements.status.value = property.status;
  propertyForm.elements.imagem_alt.value = "";
  propertyForm.elements.publicado.checked = property.publicado;
  imageInput.value = "";
  pendingImageUrls.forEach((url) => URL.revokeObjectURL(url));
  pendingImageUrls.clear();
  pendingImageFiles = [];
  currentPhotos = property.fotos.map((photo) => ({ ...photo }));
  document.querySelector("#editor-title").textContent = `Editar imóvel ${property.code}`;
  document.querySelector("#save-property-button").textContent = "Salvar alterações e fotos";
  document.querySelector("#image-help").textContent = "Adicione ou remova fotos. O limite é 15 por imóvel, incluindo as fotos atuais.";
  renderPhotoEditor();
  editorSection.hidden = false;
  editorSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function newUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function makePropertyRecord(formData) {
  return {
    code: String(formData.get("code")).trim(),
    finalidade: formData.get("finalidade"),
    tipo: formData.get("tipo"),
    titulo: String(formData.get("titulo")).trim(),
    bairro: String(formData.get("bairro")).trim(),
    preco: Number(formData.get("preco")),
    quartos: Number(formData.get("quartos")),
    vagas: Number(formData.get("vagas")),
    area: Number(formData.get("area")),
    status: formData.get("status"),
    publicado: formData.get("publicado") === "on"
  };
}

async function removeStorageImages(paths) {
  if (paths.length === 0) return null;
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    if (error) {
      console.error("Não foi possível remover imagens do armazenamento:", error);
      return error;
    }
    return null;
  } catch (error) {
    console.error("Não foi possível acessar o armazenamento para remover imagens:", error);
    return error;
  }
}

async function deletePropertyPhotoRows(ids) {
  if (ids.length === 0) return;
  const { data, error } = await supabase
    .from("property_images")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) throw error;
  if (data.length !== ids.length) {
    throw new Error("Nem todas as fotos selecionadas puderam ser removidas.");
  }
}

async function deletePropertyPhotoRowsByPaths(paths) {
  if (paths.length === 0) return;
  const { error } = await supabase
    .from("property_images")
    .delete()
    .in("storage_path", paths);
  if (error) throw error;
}

async function saveProperty(event) {
  event.preventDefault();
  if (!propertyForm.reportValidity()) return;

  const formData = new FormData(propertyForm);
  const existingId = String(formData.get("id"));
  const existingProperty = properties.find((property) => property.id === existingId);

  if (existingId && !existingProperty) {
    showStatus(adminStatus, "O imóvel selecionado não está mais na lista. Atualize os dados e tente novamente.", true);
    return;
  }
  if (currentPhotos.length + pendingImageFiles.length === 0) {
    showStatus(adminStatus, "Mantenha ou adicione pelo menos uma foto para este imóvel.", true);
    return;
  }
  if (currentPhotos.length + pendingImageFiles.length > MAX_PROPERTY_IMAGES) {
    showStatus(adminStatus, `Cada imóvel pode ter no máximo ${MAX_PROPERTY_IMAGES} fotos.`, true);
    return;
  }
  const invalidFile = pendingImageFiles.find((file) => !allowedImageTypes.has(file.type));
  if (invalidFile) {
    showStatus(adminStatus, `Formato inválido em ${invalidFile.name}. Use JPEG, PNG ou WebP.`, true);
    return;
  }
  const oversizedFile = pendingImageFiles.find((file) => file.size > MAX_IMAGE_BYTES);
  if (oversizedFile) {
    showStatus(adminStatus, `${oversizedFile.name} excede o limite de 10 MB.`, true);
    return;
  }

  const propertyId = existingId || newUuid();
  const previousPhotos = existingProperty?.fotos || [];
  const removedPhotos = previousPhotos.filter((photo) => (
    !currentPhotos.some((currentPhoto) => currentPhoto.id === photo.id)
  ));
  const uploadedPaths = [];
  let oldPhotoRowsDeleted = false;
  let createdProperty = false;
  const record = makePropertyRecord(formData);
  const saveButton = document.querySelector("#save-property-button");
  saveButton.disabled = true;
  showStatus(adminStatus, "Salvando imóvel e fotos...");

  try {
    const newPhotoRows = [];
    const usedPositions = new Set(currentPhotos.map((photo) => photo.sort_order));
    const baseAlt = String(formData.get("imagem_alt")).trim() || record.titulo;

    for (const [index, file] of pendingImageFiles.entries()) {
      const extension = allowedImageTypes.get(file.type);
      const path = `${propertyId}/${newUuid()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "300",
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      let sortOrder = 0;
      while (usedPositions.has(sortOrder)) sortOrder += 1;
      usedPositions.add(sortOrder);
      newPhotoRows.push({
        property_id: propertyId,
        storage_path: path,
        external_url: null,
        alt: `${baseAlt} - foto ${currentPhotos.length + index + 1}`,
        sort_order: sortOrder
      });
    }

    if (!existingId) {
      const { error: insertError } = await supabase
        .from("properties")
        .insert({ id: propertyId, ...record, status: "rascunho", publicado: false });
      if (insertError) throw insertError;
      createdProperty = true;
    }

    const removedIds = removedPhotos.map((photo) => photo.id);
    if (removedIds.length > 0) {
      await deletePropertyPhotoRows(removedIds);
      oldPhotoRowsDeleted = true;
    }

    if (newPhotoRows.length > 0) {
      const { data, error: photoInsertError } = await supabase
        .from("property_images")
        .insert(newPhotoRows)
        .select("id, storage_path");
      if (photoInsertError) throw photoInsertError;
      if (!Array.isArray(data) || data.length !== newPhotoRows.length) {
        throw new Error("Nem todas as novas fotos foram cadastradas.");
      }
    }

    let updateResult;
    if (existingId) {
      updateResult = await supabase
        .from("properties")
        .update(record)
        .eq("id", propertyId)
        .select("id")
        .maybeSingle();
      if (!updateResult.error && !updateResult.data) {
        updateResult.error = new Error("O imóvel não foi encontrado para atualização.");
      }
    } else {
      updateResult = await supabase
        .from("properties")
        .update({ status: record.status, publicado: record.publicado })
        .eq("id", propertyId)
        .select("id")
        .single();
    }

    if (updateResult.error) throw updateResult.error;
  } catch (error) {
    const rollbackErrors = [];

    try {
      await deletePropertyPhotoRowsByPaths(uploadedPaths);
    } catch (rollbackError) {
      rollbackErrors.push(`não foi possível desfazer o cadastro das fotos (${rollbackError.message})`);
    }

    if (oldPhotoRowsDeleted && removedPhotos.length > 0) {
      try {
        const { error: restoreError } = await supabase
          .from("property_images")
          .insert(removedPhotos.map((photo) => ({
            id: photo.id,
            property_id: photo.property_id,
            storage_path: photo.storage_path,
            external_url: photo.external_url,
            alt: photo.alt,
            sort_order: photo.sort_order,
            created_at: photo.created_at
          })));
        if (restoreError) throw restoreError;
      } catch (rollbackError) {
        rollbackErrors.push(`não foi possível restaurar as fotos anteriores (${rollbackError.message})`);
      }
    }

    if (createdProperty) {
      const { error: propertyDeleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId);
      if (propertyDeleteError) {
        rollbackErrors.push(`não foi possível remover o rascunho criado durante a operação (${propertyDeleteError.message})`);
      }
    }

    const storageError = await removeStorageImages(uploadedPaths);
    if (storageError) {
      rollbackErrors.push("não foi possível limpar todos os novos arquivos de imagem");
    }

    console.error("Erro ao salvar imóvel:", error);
    const recoveryMessage = rollbackErrors.length
      ? ` Atenção: ${rollbackErrors.join("; ")}.`
      : "";
    showStatus(adminStatus, `Não foi possível salvar o imóvel: ${error.message}.${recoveryMessage}`, true);
    return;
  } finally {
    saveButton.disabled = false;
  }

  const removedStoragePaths = removedPhotos
    .map((photo) => photo.storage_path)
    .filter(Boolean);
  const storageError = await removeStorageImages(removedStoragePaths);
  const cleanupWarning = storageError
    ? " As fotos removidas do painel não puderam ser apagadas do armazenamento."
    : "";

  setEditorOpen(false);
  try {
    await loadProperties();
    showStatus(adminStatus, `Imóvel salvo com sucesso.${cleanupWarning}`);
  } catch (refreshError) {
    console.error("Imóvel salvo, mas o inventário não pôde ser atualizado:", refreshError);
    showStatus(adminStatus, "Imóvel salvo, mas não foi possível atualizar a lista. Recarregue o painel.", true);
  }
}

async function setAuthenticatedSession(session) {
  if (!session) {
    loginSection.hidden = !isSupabaseConfigured;
    dashboardSection.hidden = true;
    return;
  }

  if (session.user.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    loginSection.hidden = false;
    dashboardSection.hidden = true;
    showStatus(loginStatus, "Esta conta não tem permissão para administrar imóveis.", true);
    return;
  }

  loginSection.hidden = true;
  dashboardSection.hidden = false;
  loginStatus.textContent = "";
  try {
    await loadProperties();
  } catch (error) {
    console.error("Erro ao carregar o painel administrativo:", error);
    showStatus(adminStatus, "Não foi possível carregar o inventário. Verifique a conexão e as políticas do Supabase.", true);
  }
}

if (!isSupabaseConfigured) {
  configNotice.hidden = false;
  loginSection.hidden = true;
} else {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;

    const values = new FormData(loginForm);
    showStatus(loginStatus, "Entrando...");
    const { error } = await supabase.auth.signInWithPassword({
      email: values.get("email"),
      password: values.get("password")
    });

    if (error) {
      console.error("Falha na autenticação do painel:", error);
      showStatus(loginStatus, "Não foi possível entrar. Confira os dados e a configuração da conta.", true);
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    queueMicrotask(() => {
      setAuthenticatedSession(session).catch((error) => {
        console.error("Erro ao verificar a sessão administrativa:", error);
        showStatus(loginStatus, "Não foi possível verificar a sessão. Tente entrar novamente.", true);
      });
    });
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    return setAuthenticatedSession(data.session);
  }).catch((error) => {
    console.error("Erro ao iniciar o painel administrativo:", error);
    showStatus(loginStatus, "Não foi possível iniciar o painel. Tente recarregar a página.", true);
  });

  document.querySelector("#logout-button").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao encerrar a sessão:", error);
      showStatus(adminStatus, "Não foi possível encerrar a sessão. Tente novamente.", true);
    }
  });

  document.querySelector("#new-property-button").addEventListener("click", () => {
    if (!confirmDiscardEditor()) return;
    setEditorOpen(false);
    setEditorOpen(true);
    document.querySelector("#editor-section").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector("#cancel-edit-button").addEventListener("click", () => {
    setEditorOpen(false);
    showStatus(adminStatus, "Edição cancelada.");
  });

  propertyForm.addEventListener("submit", saveProperty);

  imageInput.addEventListener("change", () => {
    const files = Array.from(imageInput.files);
    imageInput.value = "";
    if (files.length === 0) return;

    if (currentPhotos.length + pendingImageFiles.length + files.length > MAX_PROPERTY_IMAGES) {
      showStatus(adminStatus, `O limite é de ${MAX_PROPERTY_IMAGES} fotos por imóvel.`, true);
      return;
    }

    const invalidFile = files.find((file) => !allowedImageTypes.has(file.type));
    if (invalidFile) {
      showStatus(adminStatus, `Formato inválido em ${invalidFile.name}. Use JPEG, PNG ou WebP.`, true);
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversizedFile) {
      showStatus(adminStatus, `${oversizedFile.name} excede o limite de 10 MB.`, true);
      return;
    }

    pendingImageFiles.push(...files);
    renderPhotoEditor();
    showStatus(adminStatus, "Fotos adicionadas à prévia. Salve o imóvel para confirmar as alterações.");
  });
}
