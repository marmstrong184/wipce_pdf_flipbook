function PdfFlipbookComponent() { return {
    props: {
        src: {
            type: String,
            default: '',
        }

    },
    mounted() {
        let component = this;
        let page_container = component.$refs.pageContainer;

        let loadingTask = pdfjsLib.getDocument(this.src);
        loadingTask.promise.then(function(pdf) {
            console.log('Loaded PDF')
            component.pdf = pdf;

            for(let i = 0; i < pdf.numPages; i++) {
                let page_num = i + 1
                let new_div = document.createElement('div');
                component.page_div_map[page_num] = new_div;
                new_div.setAttribute('data-page', page_num);
                page_container.appendChild(new_div);
            }

            // TODO To allow multiple books on same webpage instead of using a hardcoded id auto generate uuid and assign.
            $('#pages-root').turn({
                display: 'single',
                acceleration: true,
                gradients: !$.isTouch,
                elevation:50,
                when: {
                    turned: function(e, page) {
                        component.onBookUpdate(page);
                    }
                }
            });

            pdf.getPage(1).then(function(page) {
                let pdf_page_width = page.getViewport()['viewBox'][2];
                let pdf_page_height = page.getViewport()['viewBox'][3];
                console.log('PDF resolution: ', pdf_page_width, pdf_page_height);

                component.pdf_aspect_ratio = pdf_page_width / pdf_page_height;
                
                component.turnjsResize();
            });

        }, function(errorReason) {
            console.error(errorReason)
            component.pdf = null

        });

        const resizeObserver = new ResizeObserver(entries => {
          for (let entry of entries) {
            const width = entry.contentRect.width;
            handleWidthChange(width);
          }
        });

        resizeObserver.observe(this.$refs.bookContainer);

        function handleWidthChange(newWidth) {
            console.log(`new width: ${newWidth}`);
            let page_container = component.$refs.pageContainer;

            // Cancel all previous render tasks which are wasting compute.
            for(let i = 0; i< component.render_task_list.length; i++) {
                // FIXME This is spamming exceptions in log. Alternative to using cancel is using timeouts and clearing the old ones.
                component.render_task_list[i].cancel();
            }

            component.render_task_list = [];

            component.removeAllCanvases();
            component.onBookUpdate(component.turnjsGetCurrentPage());
        }
    },
    data() {
        return {
            pageIndex: 0,
            pdf: null,
            pdf_aspect_ratio: 1.0,
            page_div_map: {},
            render_task_list: []
        }
    },
    methods: {
        clampPageIndex: function(pageIndex) {
            pageIndex = Math.max(0, pageIndex);
            pageIndex = Math.min(this.maxPageIndex, pageIndex);

            return pageIndex;
        },
        previousPage: function() {
            this.pageIndex = this.clampPageIndex(this.pageIndex - 1);
        },
        nextPage: function() {
            this.pageIndex = this.clampPageIndex(this.pageIndex + 1);
        },
        isValidPageIndex: function(pageIndex) {
            return this.clampPageIndex(pageIndex) == pageIndex;
        },
        removeAllCanvases: function() {
            let component = this;

            if(component.pdf == null) {
                return;
            }

            for(let i = 1; i <= component.pdf.numPages; i++) {
                let div = component.page_div_map[i];
                const old_canvas = div.querySelector('canvas');
                if(old_canvas != null) {
                    old_canvas.remove();
                }
            }
        },
        onBookUpdate: function(current_page) {
            console.log('book update ', current_page);

            let component = this;

            if(component.pdf == null) {
                return;
            }

            component.$refs.pageNumberInput.value = current_page;

            for(let i = 1; i <= component.pdf.numPages; i++) {
                let div = component.page_div_map[i];

                if ((i >= (current_page - 1)) && (i <= (current_page + 1))) {
                    // A canvas must be present here.
                    const old_canvas = div.querySelector('canvas');
                    if(old_canvas == null) {
                        const new_canvas = document.createElement('canvas');

                        new_canvas.setAttribute('data-page-canvas', 'true')
                                         
                        console.log('Getting PDF page ', i);
                        component.pdf.getPage(i).then(function(page) {
                            let canvas_container = component.$refs.pageContainer;
                            let pdf_page_width = page.getViewport()['viewBox'][2];
                            let pdf_page_height = page.getViewport()['viewBox'][3];
                            let canvas_container_width = parseFloat(window.getComputedStyle(canvas_container).width)
                            let pdf_page_width_height_ratio = pdf_page_width / pdf_page_height
                            let new_canvas_container_height = canvas_container_width / pdf_page_width_height_ratio
                            new_canvas.width = canvas_container_width
                            new_canvas.height = new_canvas_container_height
                            let scaling_factor = new_canvas.width / pdf_page_width;

                            let new_viewport = page.getViewport({scale: scaling_factor});
                            // Render PDF page into canvas context
                            let renderContext = {
                                canvasContext: new_canvas.getContext('2d'),
                                viewport: new_viewport
                            };
                            let renderTask = page.render(renderContext);
                            renderTask.promise.then(function () {
                                console.log('page ', i, ' rendered');
                            });
                            component.render_task_list.push(renderTask);
                        });
                        
                        div.appendChild(new_canvas);

                        console.log('creating canvas on page ', i);
                    }

                } else {
                    // Out of range, delete any canvas present.
                    const old_canvas = div.querySelector('canvas');
                    if(old_canvas != null) {
                        old_canvas.remove();
                        console.log('deleting canvas on page ', i);
                    }
                }
            }
            
            component.turnjsResize();
        },
        turnjsResize: function() {
            // FIXME Need a wrapper div around the page container for resizing.
            let component = this;
            let page_container = component.$refs.pageContainer;
            let page_container_wrapper = component.$refs.pageContainerWrapper;
            let page_container_width = parseFloat(window.getComputedStyle(page_container_wrapper).width);
            let new_height = page_container_width / component.pdf_aspect_ratio;
            $('#pages-root').turn('size', page_container_width, new_height);
        },
        turnjsGetCurrentPage: function() {
            let page = $(`#pages-root`).turn('page');
            
            return page;
        },
        turnjsSetCurrentPage: function(page_num) {
            $(`#pages-root`).turn('page', page_num);
        },
    },
    watch: {
        pageIndex: function(newVal, oldVal) {
            let max_pages = this.pdf == null ? 0 : this.pdf.numPages;
            this.pageIndex = max_pages - 1;
            this.pageIndex = this.clampPageIndex(newVal);

            // TODO Refactor to start at 1, not zero for page number;
            let page_num = newVal + 1;
            this.onBookUpdate(page_num);
            this.turnjsSetCurrentPage(page_num);
        },
    },
    computed: {
        pageNumber: function() {
            return this.pageIndex + 1
        },
        maxPageIndex: function() {
            return this.pdf == null ? 0 : (this.pdf.numPages - 1);
        },
    },
    template: `
    <!-- FIXME Maybe need book container max width to prevent the page overflowing vertically. -->
    <!-- FIXME Canvas rendering at half resolution on mobile. -->
    <div ref="bookContainer" style=" padding: 2px; display: inline-block; width: 100%;">
        <div style="display: flex;">
            <div class="flipbook-padding flipbook-padding-left">
            </div>

            <!-- FIXME Hardcoded width here -->
            <div style="width: 100%;" ref="pageContainerWrapper">
                <div id="pages-root" class="flipbook-page-container" ref="pageContainer">
                </div>
            </div>

            <div class="flipbook-padding flipbook-padding-right">
            </div>
        </div>

        <div class="flipbook-bottom" style="display: flex; justify-content: space-evenly; align-items: center;">
            <img 
                src="caret.svg" 
                alt="Previous Page" 
                @click="previousPage" 
                v-bind:class = "(pdf == null || pageIndex <= 0)?'page-button-disabled':'page-button-enabled'"
                class="flipbook-page-image flipbook-page-button-left"
            />
            <div>
                <div>
                    Page &nbsp;

                    <input :value="pageNumber" @change="event => pageIndex = event.target.value - 1" type="number" step="1" min="0" :max="maxPageIndex+1" style="width: 3em; font-size: 1rem;" ref="pageNumberInput">

                    &nbsp;/ {{ pdf ? pdf.numPages : 0 }}
                </div>
            </div>
            <img 
                src="caret.svg" 
                alt="Next Page" 
                @click="nextPage" 
                v-bind:class = "(pdf == null || pageIndex >= (pdf.numPages - 1))?'page-button-disabled':'page-button-enabled'"
                class="flipbook-page-image flipbook-page-image-right"
            />
        </div>
    </div>
    `
}}