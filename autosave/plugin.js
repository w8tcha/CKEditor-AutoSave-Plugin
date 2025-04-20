/**
 * @license Copyright (c) CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.html or http://ckeditor.com/license
 */

(function() {
    if (!supportsLocalStorage()) {
        CKEDITOR.plugins.add('autosave', {}); //register a dummy plugin to pass CKEditor plugin initialization process
        return;
    }

    CKEDITOR.plugins.add('autosave',
        {
            lang: 'bg,ca,cs,de,en,es,eu,fr,it,ja,nl,pl,pt-br,ru,sk,sv,uk,zh,zh-cn', // %REMOVE_LINE_CORE%
            requires: 'notification',
            version: '0.18.7',
            init: function(editor) {

                // Construct default configuration
                const defaultConfig = {
                    delay: 5,
                    messageType: 'notification',
                    saveDetectionSelectors: "a[href^='javascript:__doPostBack'][id*='Save'],a[id*='Cancel']",
                    saveOnDestroy: false,
                    NotOlderThen: 1440,
                    SaveKey: '',
                    diffType: 'sideBySide',
                    autoLoad: false,
                    removeStorageAfterAutoLoad: false,
                    SaveKeyAttribute: 'name',
                    SaveKeyDelimiter: '_',
                    SaveKeyIgnoreProto: false,
                    SaveKeyPrefix: 'autosave',
                    SaveKeyIgnoreParams: ''
                };

                // Extend CKEDITOR config and lang  - config also available at loadPlugin()
                var config = CKEDITOR.tools.extend(defaultConfig, editor.config.autosave || {}, true);

                if (!config.SaveKey.length) {
                    // Prepare temp vars for constructing local storage SaveKey name
                    var saveKeyUrl = config.SaveKeyIgnoreProto
                        ? window.location.href.replace(/https?:\/\//, '')
                        : window.location.href;

                    if (config.SaveKeyIgnoreParams.length) {
                        CKEDITOR.tools.array.forEach(config.SaveKeyIgnoreParams,
                            function() {
                                saveKeyUrl = removeUrlParam(this, null, saveKeyUrl);
                            });
                    }

                    config.SaveKey =
                        config.SaveKeyPrefix +
                        config.SaveKeyDelimiter +
                        saveKeyUrl +
                        config.SaveKeyDelimiter +
                        editor[config.SaveKeyAttribute];
                }

                CKEDITOR.document.appendStyleSheet(
                    CKEDITOR.getUrl(CKEDITOR.plugins.getPath('autosave') + 'css/autosave.min.css'));

                editor.addCommand('removeAutoSaveStorage',
                    {
                        exec: function(editor) {
                            removeStorage(config.SaveKey, editor);
                        }
                    });

                editor.on('uiSpace',
                    function(event) {
                        if (event.data.space == 'bottom' &&
                            config.messageType != null &&
                            config.messageType == 'statusbar') {

                            event.data.html +=
                                `<div class="autoSaveMessage" unselectable="on"><div unselectable="on" id="${autoSaveMessageId(event.editor)}"class="hidden">${event.editor.lang.autosave.autoSaveMessage}</div></div>`;
                        }
                    },
                    editor,
                    null,
                    100);

                editor.on('instanceReady',
                    function() {
                        if (typeof requirejs === 'function') {
                            requirejs([CKEDITOR.getUrl(CKEDITOR.plugins.getPath('autosave') + 'js/extensions.min.js')],
                                function() {
                                    loadPlugin(editor, config);
                                });
                        } else {
                            CKEDITOR.scriptLoader.load(
                                CKEDITOR.getUrl(CKEDITOR.plugins.getPath('autosave') + 'js/extensions.min.js'),
                                function() {
                                    loadPlugin(editor, config);
                                });
                        }
                    },
                    editor,
                    null,
                    100);
            }
        });

    function loadPlugin(editorInstance, config) {

        GenerateAutoSaveDialog(editorInstance, config, config.SaveKey);

        checkForAutoSavedContent(editorInstance, config, config.SaveKey, config.NotOlderThen);

        CKEDITOR.tools.array.forEach(CKEDITOR.document.find(config.saveDetectionSelectors).toArray(),
            function(el) {
                el.$.addEventListener('click',
                    function() {
                        removeStorage(config.SaveKey, editorInstance);
                    });
            });

        editorInstance.on('change',
            function() {
                startTimer(config, editorInstance);
            });

        editorInstance.on('blur',
            function() {
                startTimer(config, editorInstance);
            });

        editorInstance.on('destroy',
            function() {
                if (config.saveOnDestroy) {
                    saveData(config.SaveKey, editorInstance, config);
                }
            });
    }

    function autoSaveMessageId(editorInstance) {
        return `cke_autoSaveMessage_${editorInstance.name}`;
    }

    var startTimer = function(configAutosave, editorInstance) {
        if (editorInstance.config.autosave_timeOutId == null) {
            const delay = configAutosave.delay != null ? configAutosave.delay : 10;
            editorInstance.config.autosave_timeOutId = setTimeout(function() {
                    onTimer(configAutosave, editorInstance);
                },
                delay * 1000);
        }
    };

    function onTimer(configAutosave, editorInstance) {
        if (editorInstance.checkDirty() || editorInstance.plugins.bbcode) {
            const editor = editorInstance;
            const autoSaveKey = configAutosave.SaveKey != null
                ? configAutosave.SaveKey
                : `autosave_${window.location}_${document.getElementById(editor.name).getAttribute('name')}`;

            saveData(autoSaveKey, editor, configAutosave);

            clearTimeout(editorInstance.config.autosave_timeOutId);

            editorInstance.config.autosave_timeOutId = null;
        }
    };

    // localStorage detection
    function supportsLocalStorage() {
        if (typeof (Storage) === 'undefined') {
            return false;
        }

        try {
            localStorage.getItem('___test_key');
            return true;
        } catch (e) {
            return false;
        }
    }

    function GenerateAutoSaveDialog(editorInstance, config, autoSaveKey) {
        CKEDITOR.dialog.add('autosaveDialog',
            function() {
                return {
                    title: editorInstance.lang.autosave.title,
                    minHeight: 155,
                    height: 300,
                    width: 800,
                    onShow: function() {
                        renderDiff(this, editorInstance, autoSaveKey);
                    },
                    onOk: function() {
                        if (localStorage.getItem(autoSaveKey)) {
                            const jsonSavedContent = loadData(autoSaveKey);

                            removeStorage(autoSaveKey, editorInstance);

                            editorInstance.setData(jsonSavedContent.data);
                        }
                    },
                    onCancel: function() {
                        removeStorage(autoSaveKey, editorInstance);
                    },
                    contents: [
                        {
                            label: '',
                            id: 'general',
                            elements: [
                                {
                                    type: 'radio',
                                    id: 'diffType',
                                    label: editorInstance.lang.autosave.diffType,
                                    items: [
                                        [editorInstance.lang.autosave.sideBySide, 'sideBySide'],
                                        [editorInstance.lang.autosave.inline, 'inline']
                                    ],
                                    'default': config.diffType,
                                    onClick: function() {
                                        renderDiff(this._.dialog, editorInstance, autoSaveKey);
                                    }
                                }, {
                                    type: 'html',
                                    id: 'diffContent',
                                    html: ''
                                }
                            ]
                        }
                    ],
                    buttons: [
                        {
                            id: 'ok',
                            type: 'button',
                            label: editorInstance.lang.autosave.ok,
                            'class': 'cke_dialog_ui_button_ok cke_dialog_autosave_ok',
                            onClick: function(evt) {
                                const dialog = evt.data.dialog;
                                if (dialog.fire('ok', { hide: true }).hide !== false)
                                    dialog.hide();
                            }
                        },
                        {
                            id: 'cancel',
                            type: 'button',
                            label: editorInstance.lang.autosave.no,
                            'class': 'cke_dialog_ui_button_cancel',
                            onClick: function(evt) {
                                const dialog = evt.data.dialog;
                                if (dialog.fire('cancel', { hide: true }).hide !== false)
                                    dialog.hide();
                            }
                        }
                    ]
                };
            });
    }

    function checkForAutoSavedContent(editorInstance, config, autoSaveKey, notOlderThen) {
        // Checks If there is data available and load it
        if (localStorage.getItem(autoSaveKey)) {
            let jsonSavedContent = loadData(autoSaveKey);

            if (!isJson(jsonSavedContent)) {
	            return;
            }

            const autoSavedContent = jsonSavedContent.data;
            const autoSavedContentDate = jsonSavedContent.saveTime;

            const editorLoadedContent = editorInstance.getData();

            // check if the loaded editor content is the same as the auto saved content
            if (editorLoadedContent == autoSavedContent) {
                localStorage.removeItem(autoSaveKey);
                return;
            }

            // Ignore if auto saved content is older than x minutes
            if (moment(new Date()).diff(new Date(autoSavedContentDate), 'minutes') > notOlderThen) {
                removeStorage(autoSaveKey, editorInstance);

                return;
            }

            if (config.autoLoad) {
                if (localStorage.getItem(autoSaveKey)) {
                    jsonSavedContent = loadData(autoSaveKey);

                    if (!isJson(jsonSavedContent)) {
	                    return;
                    }

                    editorInstance.setData(jsonSavedContent.data);

                    if (config.removeStorageAfterAutoLoad) {
                        removeStorage(autoSaveKey, editorInstance);
                    }
                }
            } else {
                const confirmMessage = editorInstance.lang.autosave.loadSavedContent.replace('{0}',
                    moment(autoSavedContentDate).locale(editorInstance.config.language)
                    .format(editorInstance.lang.autosave.dateFormat));

                if (confirm(confirmMessage)) {
                    // Open DIFF Dialog
                    editorInstance.openDialog('autosaveDialog');
                } else {
                    removeStorage(autoSaveKey, editorInstance);
                }
            }
        }
    }

    function loadData(autoSaveKey) {
        const compressedJson = LZString.decompressFromUTF16(localStorage.getItem(autoSaveKey));
        return JSON.parse(compressedJson);
    }

    function saveData(autoSaveKey, editorInstance, config) {
        const compressedJson = LZString.compressToUTF16(JSON.stringify({ data: editorInstance.getData(), saveTime: new Date() }));

        var quotaExceeded = false;

        try {
            localStorage.setItem(autoSaveKey, compressedJson);
        } catch (e) {
            quotaExceeded = isQuotaExceeded(e);
            if (quotaExceeded) {
                console.log(editorInstance.lang.autosave.localStorageFull);
            }
        }

        if (quotaExceeded) {
            const notificationError = new CKEDITOR.plugins.notification(editorInstance,
                { message: editorInstance.lang.autosave.localStorageFull, type: 'warning' });
            notificationError.show();
        } else {
            let messageType = config.messageType != null ? config.messageType : 'notification';

            if (editorInstance.plugins.wordcount &&
                messageType == 'statusbar' &&
                editorInstance.container.$.clientWidth < 150) {
                messageType = 'notification';
            }

            if (messageType == 'statusbar') {
                var autoSaveMessage = document.getElementById(autoSaveMessageId(editorInstance));

                if (autoSaveMessage) {
                    autoSaveMessage.className = 'show';

                    setTimeout(function() {
                            autoSaveMessage.className = 'hidden';
                        },
                        2000);
                }
            } else if (messageType == 'notification') {
                const notification = new CKEDITOR.plugins.notification(editorInstance,
                    { message: editorInstance.lang.autosave.autoSaveMessage, type: 'success' });
                notification.show();
            }
        }
    }

    function removeStorage(autoSaveKey, editor) {
        if (editor.config.autosave_timeOutId) {
            clearTimeout(editor.config.autosave_timeOutId);
        }

        localStorage.removeItem(autoSaveKey);
    }

    function renderDiff(dialog, editorInstance, autoSaveKey) {
        const jsonSavedContent = loadData(autoSaveKey);

        const base = difflib.stringAsLines(editorInstance.getData());
        const newText = difflib.stringAsLines(jsonSavedContent.data);
        const sm = new difflib.SequenceMatcher(base, newText);
        const opcodes = sm.get_opcodes();

        dialog.getContentElement('general', 'diffContent').getElement().setHtml(`<div class="diffContent">${diffview.buildView({
            baseTextLines: base,
            newTextLines: newText,
            opcodes: opcodes,
            baseTextName: editorInstance.lang.autosave.loadedContent,
            newTextName: editorInstance.lang.autosave.autoSavedContent +
                (moment(jsonSavedContent.saveTime).locale(editorInstance.config.language)
                    .format(editorInstance.lang.autosave.dateFormat)) +
                "'",
            contextSize: 3,
            viewType: dialog.getContentElement('general', 'diffType').getValue() == 'inline' ? 1 : 0
        }).outerHTML}</div>`);
    }

    function isQuotaExceeded(e) {
        var quotaExceeded = false;
        if (e) {
            if (e.code) {
                switch (e.code) {
                case 22:
                    quotaExceeded = true;
                    break;
                case 1014:
                    // Firefox
                    if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                        quotaExceeded = true;
                    }
                    break;
                }
            } else if (e.number === -2147024882) {
                // Internet Explorer 8
                quotaExceeded = true;
            }
        }
        return quotaExceeded;
    }

    // Querystring mitigator - Quick and dirty paste.
    // I don't know who original author is for creds.
    // https://stackoverflow.com/a/11654436/2418655
    function removeUrlParam(key, value, url) {
        if (!url) url = window.location.href;
        const re = new RegExp(`([?&])${key}=.*?(&|#|$)(.*)`, 'gi');
        var hash;

        if (re.test(url)) {
            if (typeof value !== 'undefined' && value !== null) {
                return url.replace(re, `$1${key}=${value}$2$3`);
            } else {
                hash = url.split('#');
                url = hash[0].replace(re, '$1$3').replace(/(&|\?)$/, '');
                if (typeof hash[1] !== 'undefined' && hash[1] !== null) {
                    url += `#${hash[1]}`;
                }
                return url;
            }
        } else {
            if (typeof value !== 'undefined' && value !== null) {
                const separator = url.indexOf('?') !== -1 ? '&' : '?';
                hash = url.split('#');
                url = hash[0] + separator + key + '=' + value;
                if (typeof hash[1] !== 'undefined' && hash[1] !== null) {
                    url += `#${hash[1]}`;
                }
                return url;
            } else {
                return url;
            }
        }
    }

    function isJson(item) {
	    let value = typeof item !== 'string' ? JSON.stringify(item) : item;
	    try {
		    value = JSON.parse(value);
	    } catch (e) {
		    return false;
	    }

	    return typeof value === 'object' && value !== null;
    }
})();
