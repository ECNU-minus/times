function initialize_fc_lite() {
  // User Configuration
  UserConfig = {
    private_api_url: UserConfig?.private_api_url || "",
    page_turning_number: UserConfig?.page_turning_number || 24,
    error_img:
      UserConfig?.error_img ||
      "https://fastly.jsdelivr.net/gh/willow-god/Friend-Circle-Lite/static/favicon.ico",
  };

  const root = document.getElementById("friend-circle-lite-root");
  if (!root) return;

  // --- 1. Inject Styles ---
  const styleId = "fc-lite-multiselect-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      /* Button styles - Left aligned, no wrapper */
      .fcl-dropdown-btn { 
        display: inline-flex; 
        justify-content: space-between; 
        align-items: center;
        padding: 8px 12px; 
        border: 1px solid #ccc; 
        border-radius: 4px; 
        background: #fff; 
        cursor: pointer; 
        min-width: 150px; 
        text-align: left; 
        margin-bottom: 20px; /* Space before articles */
        user-select: none;
        font-family: sans-serif;
        font-size: 14px;
        color: #333;
      }
      .fcl-dropdown-btn:hover { border-color: #888; }
      
      /* Dropdown Menu - Floating on top */
      .fcl-dropdown-content {
        display: none; 
        position: fixed; /* Fixed to viewport to ensure it floats on top */
        background-color: #fff; 
        min-width: 200px; 
        box-shadow: 0px 4px 12px rgba(0,0,0,0.15); 
        z-index: 99999; 
        max-height: 300px; 
        overflow-y: auto; 
        border-radius: 4px; 
        padding: 5px 0; 
        border: 1px solid #eee;
      }
      .fcl-dropdown-content.show { display: block; }
      
      /* Checkbox Items */
      .fcl-checkbox-item { 
        display: block; 
        padding: 8px 12px; 
        cursor: pointer; 
        user-select: none; 
        font-size: 14px; 
        color: #333;
        margin: 0;
      }
      .fcl-checkbox-item:hover { background-color: #f5f5f5; }
      .fcl-checkbox-item input { margin-right: 10px; cursor: pointer; }
      .fcl-arrow { font-size: 10px; margin-left: 10px; opacity: 0.6; }
    `;
    document.head.appendChild(style);
  }

  // Clear previous content
  root.innerHTML = "";

  // --- 2. Create UI Elements (No Filter Container) ---

  // Create the Button
  const dropdownBtn = document.createElement("div");
  dropdownBtn.className = "fcl-dropdown-btn";
  dropdownBtn.innerHTML = `<span>筛选作者 (全部)</span> <span class="fcl-arrow">▼</span>`;

  // Create the Dropdown List (Hidden by default)
  const dropdownContent = document.createElement("div");
  dropdownContent.className = "fcl-dropdown-content";
  dropdownContent.id = "fcl-dropdown-list";

  // Create Article Container
  const container = document.createElement("div");
  container.className = "articles-container";
  container.id = "articles-container";
  // Add clear fix style to container in case button floats
  container.style.clear = "both";

  // --- 3. Append to Root ---
  // We insert the button directly before the article container
  root.appendChild(dropdownBtn);
  // We append the menu to root (it will be positioned by JS)
  root.appendChild(dropdownContent);
  root.appendChild(container);

  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.id = "load-more-btn";
  loadMoreBtn.innerText = "再来亿点";
  root.appendChild(loadMoreBtn);

  const statsContainer = document.createElement("div");
  statsContainer.id = "stats-container";
  root.appendChild(statsContainer);

  // --- 4. Logic Variables ---
  let start = 0;
  let allArticles = [];
  let currentFilteredArticles = [];
  let selectedAuthors = new Set();

  // --- 5. Event Handlers ---

  // Toggle Dropdown
  dropdownBtn.onclick = (e) => {
    e.stopPropagation();
    const isVisible = dropdownContent.classList.contains("show");

    // Hide any other open menus
    document
      .querySelectorAll(".fcl-dropdown-content")
      .forEach((el) => el.classList.remove("show"));

    if (!isVisible) {
      // Position the menu right below the button
      const rect = dropdownBtn.getBoundingClientRect();
      dropdownContent.style.top = rect.bottom + 5 + "px";
      dropdownContent.style.left = rect.left + "px";
      dropdownContent.classList.add("show");
    }
  };

  // Close when clicking outside
  const closeDropdown = (e) => {
    if (
      e.type === "click" &&
      (dropdownBtn.contains(e.target) || dropdownContent.contains(e.target))
    ) {
      return;
    }
    dropdownContent.classList.remove("show");
  };

  window.addEventListener("click", closeDropdown);
  window.addEventListener("scroll", closeDropdown, true);
  window.addEventListener("resize", closeDropdown);

  // --- 6. Data & Rendering Functions ---

  function loadInitialData() {
    const cacheKey = "friend-circle-lite-cache";
    const cacheTimeKey = "friend-circle-lite-cache-time";
    const cacheTime = localStorage.getItem(cacheTimeKey);
    const now = new Date().getTime();

    if (cacheTime && now - cacheTime < 30 * 60 * 1000) {
      const cachedData = JSON.parse(localStorage.getItem(cacheKey));
      if (cachedData) {
        processArticles(cachedData);
        return;
      }
    }

    fetch(`${UserConfig.private_api_url}all.json`)
      .then((response) => response.json())
      .then((data) => {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimeKey, now.toString());
        processArticles(data);
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
      });
  }

  function applyFilters() {
    let filtered = allArticles;

    // Multiselect Filtering Logic
    if (selectedAuthors.size > 0) {
      filtered = filtered.filter((a) => selectedAuthors.has(a.author));
      dropdownBtn.querySelector(
        "span"
      ).innerText = `已选 ${selectedAuthors.size} 位作者`;
    } else {
      dropdownBtn.querySelector("span").innerText = `筛选作者 (全部)`;
    }

    start = 0;
    currentFilteredArticles = filtered;
    const articlesToShow = filtered.slice(0, UserConfig.page_turning_number);
    renderArticles(articlesToShow);
    start = articlesToShow.length;
    loadMoreBtn.style.display =
      filtered.length > UserConfig.page_turning_number ? "block" : "none";
  }

  function processArticles(data) {
    allArticles = data.article_data;

    const uniqueAuthors = [...new Set(allArticles.map((data) => data.author))];
    dropdownContent.innerHTML = "";

    uniqueAuthors.forEach((author) => {
      const label = document.createElement("label");
      label.className = "fcl-checkbox-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = author;

      // Prevent menu closing when clicking inside
      checkbox.addEventListener("click", (e) => e.stopPropagation());

      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          selectedAuthors.add(author);
        } else {
          selectedAuthors.delete(author);
        }
        applyFilters();
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + author));

      label.addEventListener("click", (e) => e.stopPropagation());

      dropdownContent.appendChild(label);
    });

    currentFilteredArticles = [...allArticles];

    const stats = data.statistical_data;
    statsContainer.innerHTML = `
            <div>Powered by: <a href="https://github.com/willow-god/Friend-Circle-Lite" target="_blank">FriendCircleLite</a><br></div>
            <div>Designed By: <a href="https://www.liushen.fun/" target="_blank">LiuShen</a><br></div>
            <div>订阅:${stats.friends_num}   活跃:${stats.active_num}   总文章数:${stats.article_num}<br></div>
            <div>更新时间:${stats.last_updated_time}</div>
        `;

    container.innerHTML = "";
    const initialArticles = currentFilteredArticles.slice(
      0,
      UserConfig.page_turning_number
    );
    initialArticles.forEach((article) =>
      container.appendChild(createArticleCard(article))
    );
    start = initialArticles.length;
    loadMoreBtn.style.display =
      currentFilteredArticles.length > UserConfig.page_turning_number
        ? "block"
        : "none";
  }

  function createArticleCard(article) {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "card-title";
    title.innerText = article.title;
    title.onclick = () => window.open(article.link, "_blank");
    card.appendChild(title);

    const author = document.createElement("div");
    author.className = "card-author";
    const authorImg = document.createElement("img");
    authorImg.className = "no-lightbox";
    authorImg.src = article.avatar || UserConfig.error_img;
    authorImg.onerror = () => (authorImg.src = UserConfig.error_img);
    author.appendChild(authorImg);
    author.appendChild(document.createTextNode(article.author));
    card.appendChild(author);

    author.onclick = () => {
      showAuthorArticles(article.author, article.avatar, article.link);
    };

    const date = document.createElement("div");
    date.className = "card-date";
    date.innerText = "🗓️" + article.created.substring(0, 10);
    card.appendChild(date);

    const bgImg = document.createElement("img");
    bgImg.className = "card-bg no-lightbox";
    bgImg.src = article.avatar || UserConfig.error_img;
    bgImg.onerror = () => (bgImg.src = UserConfig.error_img);
    card.appendChild(bgImg);

    return card;
  }

  function loadMoreArticles() {
    const nextStart = start;
    const nextEnd = start + UserConfig.page_turning_number;
    const nextArticles = currentFilteredArticles.slice(nextStart, nextEnd);

    if (nextArticles.length === 0) {
      loadMoreBtn.style.display = "none";
      return;
    }
    nextArticles.forEach((article) => {
      const card = createArticleCard(article);
      container.appendChild(card);
    });

    start = nextEnd;
    if (start >= currentFilteredArticles.length) {
      loadMoreBtn.style.display = "none";
    }
  }

  function renderArticles(articleToRender) {
    container.innerHTML = "";
    articleToRender.forEach((article) => {
      const card = createArticleCard(article);
      container.appendChild(card);
    });
  }

  function showAuthorArticles(author, avatar, link) {
    if (!document.getElementById("fclite-modal")) {
      const modal = document.createElement("div");
      modal.id = "modal";
      modal.className = "modal";
      modal.innerHTML = `
            <div class="modal-content">
                <img id="modal-author-avatar" src="" alt="">
                <a id="modal-author-name-link"></a>
                <div id="modal-articles-container"></div>
                <img id="modal-bg" src="" alt="">
            </div>
            `;
      root.appendChild(modal);
    }

    const modal = document.getElementById("modal");
    const modalArticlesContainer = document.getElementById(
      "modal-articles-container"
    );
    const modalAuthorAvatar = document.getElementById("modal-author-avatar");
    const modalAuthorNameLink = document.getElementById(
      "modal-author-name-link"
    );
    const modalBg = document.getElementById("modal-bg");

    modalArticlesContainer.innerHTML = "";
    modalAuthorAvatar.src = avatar || UserConfig.error_img;
    modalAuthorAvatar.onerror = () =>
      (modalAuthorAvatar.src = UserConfig.error_img);
    modalBg.src = avatar || UserConfig.error_img;
    modalBg.onerror = () => (modalBg.src = UserConfig.error_img);
    modalAuthorNameLink.innerText = author;
    modalAuthorNameLink.href = new URL(link).origin;

    const authorArticles = allArticles.filter(
      (article) => article.author === author
    );

    authorArticles.slice(0, 4).forEach((article) => {
      const articleDiv = document.createElement("div");
      articleDiv.className = "modal-article";

      const title = document.createElement("a");
      title.className = "modal-article-title";
      title.innerText = article.title;
      title.href = article.link;
      title.target = "_blank";
      articleDiv.appendChild(title);

      const date = document.createElement("div");
      date.className = "modal-article-date";
      date.innerText = "📅" + article.created.substring(0, 10);
      articleDiv.appendChild(date);

      modalArticlesContainer.appendChild(articleDiv);
    });

    modal.style.display = "block";
    setTimeout(() => {
      modal.classList.add("modal-open");
    }, 10);
  }

  function hideModal() {
    const modal = document.getElementById("modal");
    modal.classList.remove("modal-open");
    modal.addEventListener(
      "transitionend",
      () => {
        modal.style.display = "none";
        root.removeChild(modal);
      },
      { once: true }
    );
  }

  loadInitialData();
  loadMoreBtn.addEventListener("click", loadMoreArticles);

  window.onclick = function (event) {
    const modal = document.getElementById("modal");
    if (event.target === modal) {
      hideModal();
    }
  };
}

function whenDOMReady() {
  initialize_fc_lite();
}

whenDOMReady();
document.addEventListener("pjax:complete", initialize_fc_lite);
