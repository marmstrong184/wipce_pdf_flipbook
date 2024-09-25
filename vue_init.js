const App = Vue.createApp({})
    
App.component('pdf-flipbook', PdfFlipbookComponent())

App.mount('#vue-root')