// 引入 gulp
var gulp = require('gulp'); 

// 引入组件
var jshint = require('gulp-jshint');//js检测
var less = require('gulp-less');//less编译
var cleanCss=require('gulp-clean-css');//css压缩
var imagemin=require('gulp-imagemin');//图片压缩
var spriter=require('gulp-css-spriter');//精灵图
var concat = require('gulp-concat');//合并
var uglify = require('gulp-uglify');//js压缩
var rename = require('gulp-rename');//重命名
var del=require('del');//文件删除

// 检查脚本
gulp.task('lint', function() {
    gulp.src('./js/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

// 编译less
gulp.task('less', function() {
    gulp.src('./less/*.less')
        .pipe(less())
        .pipe(gulp.dest('./css'));
});

//css压缩、合并
gulp.task('minify-css', function() {
	gulp.src('./css/*.css')
		.pipe(concat('all.css'))
		.pipe(gulp.dest('./resources/css'))
		.pipe(rename('all.min.css'))
	    .pipe(cleanCss())
	    .pipe(gulp.dest('./resources/css'))
});

//图片压缩
gulp.task('imagemin',function(){
	gulp.src('./img/*')
	.pipe(imagemin())
	.pipe(gulp.dest('./resources/images'))
})

//js 合并，压缩文件
gulp.task('minify-js', function() {
    gulp.src('./js/*.js')
        .pipe(concat('com_tradeDetail.js'))
        .pipe(gulp.dest('./resources/js'))
        .pipe(rename('com_tradeDetail.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./resources/js'));
});

//清理文件
gulp.task('clean',function(){
	del(['./resources/css/all.css','./resources/css/all.min.css','./resources/js/com_tradeDetail.js','./resources/js/com_tradeDetail.min.js'])
})

// 默认任务
gulp.task('default', function(){
    gulp.run('lint', 'less', 'minify-css','minify-js');

});