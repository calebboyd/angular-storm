module.exports = function (grunt) {

    var stormSource = [
        'src/storm.prefix',
        'src/stormCommon.js',
        'src/stormTypes.js',
        'src/stormModels.js',
        'src/stormQueryBuilders.js',
        'src/stormHttp.js',
        'src/stormExtension.js',
        'src/stormCollection.js',
        'src/stormEntity.js',
        'src/stormValidate.js',
        'src/stormValidateDirective.js',
        'src/storm.js',
        'src/storm.suffix'
    ];


    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        library: grunt.file.readJSON('bower.json'),
        concat: {
            dev: {
                src: stormSource,
                dest: 'dist/<%= library.name %>.js',
                options: {
                    separator: ''
                }
            }
        },
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
            },
            jid: {
                files: {
                    'dist/<%= library.name %>.min.js': ['<%= concat.dev.dest %>']
                }
            }
        },
        jshint: {
            beforeConcat: {
                src: ['src/*.js']
            },
            afterConcat: {
                src: [
                    '<%= concat.dev.dest %>'
                ]
            },
            options: {
                validthis: true,
                // options here to override JSHint defaults
                globals: {
                    console: true,
                    module: true,
                    document: true,
                    angular: true
                },
                globalstrict: false
            }
        },
        watch: {
            options: {
                livereload: true
            },
            files: [
                'Gruntfile.js',
                'src/*'
            ],
            tasks: ['default']
        },
        copy: {
            dev: {
                files: [
                    {
                        src: 'dist/angular-storm.js',
                        dest: 'demo/lib/angular-storm.js'
                    },
                    {
                        src: 'lib/fromjs/from.src.js',
                        dest: 'demo/lib/from.src.js'
                    }
                ]
            }
        },
        karma: {
            unit: {
                configFile: 'karma-unit.conf.js'
            }
        }

    });
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');    

    grunt.registerTask('rebase', ['concat:rebase', 'jshint:afterConcatRebase', 'copy:rebase']);
    grunt.registerTask('default', [/*'jshint:beforeConcat',*/ 'concat:dev', 'jshint:afterConcat', 'uglify', 'copy:dev']);
    grunt.registerTask('livereload', ['default', 'watch']);
    grunt.registerTask('demo', 'Run the demo server on Port 8080', function () {
        require('./demo.js').run(this.async());
    });
};