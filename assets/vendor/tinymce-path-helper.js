export function getTinyMCEPath() {
  return "/assets/vendor/tinymce/js/tinymce/tinymce.min.js";
}

export function validateTinyMCEStructure() {
  return {
    script: "/assets/vendor/tinymce/js/tinymce/tinymce.min.js",
    folders: [
      "/assets/vendor/tinymce/js/tinymce/icons/",
      "/assets/vendor/tinymce/js/tinymce/langs/",
      "/assets/vendor/tinymce/js/tinymce/models/",
      "/assets/vendor/tinymce/js/tinymce/plugins/",
      "/assets/vendor/tinymce/js/tinymce/skins/",
      "/assets/vendor/tinymce/js/tinymce/themes/"
    ]
  };
}
