const express = require('express');
const router = express.Router();
const conn = require('./../db/db')
const svgCaptcha = require('svg-captcha')
const sms_util = require('./../util/sms_util')
const md5 = require('blueimp-md5')

let users = {} // 用户信息


/* 添加商品到购物车 */
router.post('/api/add_shop_car', (req, res) => {
    // 1. authentication
    let user_id = req.body.user_id;
    if (!user_id || user_id !== req.session.userId) {
        res.json({err_code: 0, message: '用户错误'})
        return;
    }
    // 2. get shopInfo of client
    let goods_id = req.body.goods_id;
    let goods_name = req.body.goods_name;
    let thumb_url = req.body.thumb_url;
    let price = req.body.price;
    let buy_count = 1;
    let is_pay = 0;
    // 3.search data
    let sqlStr = "SELECT * FROM lk_pdd_cart WHERE goods_id = '" + goods_id + "' LIMIT 1";
    conn.query(sqlStr, (error, results, fields) => {
        if (error) {
            res.json({err_code: 0, message: '数据错误'})
        } else {
            results = JSON.parse(JSON.stringify(results))
            if (results[0]) { // 3.1 hasGoods
                console.log(results[0])
                let buy_count = results[0].buy_count + 1;
                console.log(buy_count)
                let sql_str = "UPDATE lk_pdd_cart SET buy_count = " + buy_count + " WHERE goods_id = '" + goods_id + "'";
                conn.query(sql_str, (error, results, fields) => {
                    if (error) {
                        res.json({err_code: 0, message: '加入购物车失败'})
                    } else {
                        res.json({success_code: 200, message: '加入成功'})
                    }
                })
            } else { // 3.2商品不存在
                let add_sql = "INSERT INTO lk_pdd_cart(goods_id,goods_name, thumb_url, price, buy_count,is_pay) VALUES (?,?,?,?,?,?)";
                let sql_params = [goods_id, goods_name, thumb_url, price, buy_count, is_pay];
                conn.query(add_sql, sql_params, (error, results, fields) => {
                    if (error) {
                        res.json({err_code: 0, message: '加入购物车失败'})
                    } else {
                        res.json({success_code: 200, message: '加入成功'})
                    }
                })
            }
        }
    })
})

/* 查询购物车数据 */
router.get('/api/car_goods', (req, res) => {
    // 1. 获取参数
    let user_id = req.body.user_id;
    if (!req.session.userId) {
        res.json({err_code: 0, message: '请先登陆'})
        return;
    }
    //1.1 数据库查询语句
    let sqlStr = "SELECT * from lk_pdd_cart"
    conn.query(sqlStr, (error, results, fields) => {
        if (error) {
            res.json({err_code: 0, message: '请求数据失败'})
        } else {
            res.json({success_code: 200,message: results })
        }
    })
})

/* 删除购物车数据 */
router.post('/api/del_car_goods', (req, res) => {
    // 1. 获取参数
    let user_id = req.body.user_id;
    let goods_id = req.body.goods_id;
    if (!req.session.userId) {
        res.json({err_code: 0, message: '请先登陆'})
        return;
    }
    //1.1 数据库查询语句
    let sqlStr = "DELETE FROM lk_pdd_cart WHERE goods_id=" + goods_id;
    conn.query(sqlStr, (error, results, fields) => {
        if (error) {
            res.json({err_code: 0, message: '数据发送失败'})
        } else {
            res.json({success_code: 200,message: results })
        }
    })
})


/*根据session中的用户id获取用户信息*/
router.get('/api/user_info', (req, res) => {
    // 1.0 获取参数
    let userId = req.session.userId;
    //1.1 数据库查询语句
    let sqlStr = "SELECT * from pdd_user_info where id = '" + userId + "'LIMIT 1"
    conn.query(sqlStr, (error, results, fields) => {
        if (error) {
            res.json({err_code: 0, message: '请求数据失败'})
        } else {
            results = JSON.parse(JSON.stringify(results))
            console.log(results)
            if (!results[0]) {
                delete req.session.userId;
                res.json({err_code: 1, message: '请先登录'})
            } else {
                // 返回数据给客户端
                res.json({
                    success_code: 200,
                    message: results[0]
                })
            }
        }
    })

});

/* 修改用户信息 */
router.post('/api/change_user_msg', (req, res) => {
    // 1. getUserInfo
    const id = req.body.user_id;
    const user_name = req.body.user_name || '';
    const user_sex = req.body.user_sex || '';
    const user_address = req.body.user_address || '';
    const user_phone = req.body.user_phone || '';
    const user_birthday = req.body.user_birthday || '';
    const user_sign = req.body.user_sign || '';
    // 2.Authentication
    if (!id) {
        res.json({err_code: 0, message: '修改用户信息失败'})
    } else {
        // 3. update 更新数据
        let sqlStr = "UPDATE pdd_user_info SET user_name=?, user_sex=?,user_address=?,user_birthday=?,user_phone=?,user_sign=? WHERE id =" + id;
        let strParams = [user_name, user_sex, user_address, user_birthday, user_phone, user_sign];
        conn.query(sqlStr, strParams, (error, results, fields) => {
            if (error) {
                res.json({err_code: 0, message: '修改用户信息失败'})
            } else {
                res.json({success_code: 200, message: '修改用户信息成功'})
            }
        })
    }
})

/* 退出登陆 */
router.get('/api/logout', (req, res) => {
    delete req.session.userId;
    res.json({
        success_code: 200,
        message: '退出登陆成功'
    })
})

/*
手机验证码登陆
* */
router.post('/api/login_code', (req, res) => {
    //1.获取数据
    const phone = req.body.phone;
    const code = req.body.code;
    //2.验证验证码是否正确
    if (users[phone] !== code) {
        res.json({err_code: 0, message: '验证码不正确'})
        return;
    }
    //3.查询数据
    delete users[phone];
    //3.1查询语句
    let sqlStr = "SELECT * from pdd_user_info where user_phone = '" + phone + "'LIMIT 1"
    conn.query(sqlStr, (error, results, fields) => {
        if (error) {
            res.json({err_code: 0, message: '请求数据失败'})
        } else {
            results = JSON.parse(JSON.stringify(results))
            if (results[0]) { // 用户已经存在
                // console.log(results[0])
                req.session.userId = results[0].id
                // 返回数据给客户端
                res.json({
                    success_code: 200,
                    message: results[0]
                })
            } else { // 新用户
                const addSql = "INSERT INTO pdd_user_info(user_name, user_phone) values(?,?)"
                const addSqlParams = [phone, phone]
                conn.query(addSql, addSqlParams, (error, results, fiels) => {
                    results = JSON.parse(JSON.stringify(results))
                    if (!error) {
                        req.session.userId = results.insertId
                        let sqlStr = "SELECT * from pdd_user_info where id = '" + results.insertId + "'LIMIT 1"
                        conn.query(sqlStr, (error, results, fields) => {
                            if (error) {
                                res.json({err_code: 0, message: '请求数据失败'})
                            } else {
                                results = JSON.parse(JSON.stringify(results))
                                // 返回数据给客户端
                                res.json({
                                    success_code: 200,
                                    message: results[0]
                                })
                            }
                        })
                    }
                })
            }
        }
    })
})

/* 用户名和密码登陆 */
router.post('/api/login_pwd', (req, res) => {
    //1.获取数据
    const user_name = req.body.name;
    const user_pwd = req.body.pwd;
    const captcha = req.body.captcha.toLowerCase()
    // console.log(captcha, req.session.captcha,req.session)
    //2.验证图形验证码是否正确
    if (captcha != req.session.captcha) {
        res.json({err_code: 0, message: '图形验证码不正确'})
        return
    }
    delete req.session.captcha;

    //3.查询数据
    //3.1查询语句
    let sqlStr = "SELECT * from pdd_user_info where user_name = '" + user_name + "'LIMIT 1"
    conn.query(sqlStr, (error, results, fields) => {
        if (error) {
            res.json({err_code: 0, message: '用户名不正确'})
        } else {
            results = JSON.parse(JSON.stringify(results))
            if (results[0]) { // 用户已经存在
                // 验证密码是否正确
                if (results[0].user_pwd !== user_pwd) {
                    res.json({err_code: 0, message: '密码不正确'})
                } else {
                    req.session.userId = results[0].id;
                    // 返回数据给客户端
                    res.json({
                        success_code: 200,
                        message: results[0],
                        info: '登陆成功!'
                    })
                }
            } else { // 新用户
                const addSql = "INSERT INTO pdd_user_info(user_name, user_pwd) values(?,?)"
                const addSqlParams = [user_name, user_pwd]
                conn.query(addSql, addSqlParams, (error, results, fiels) => {
                    results = JSON.parse(JSON.stringify(results))
                    // console.log(results)
                    if (!error) {
                        req.session.userId = results.insertId
                        let sqlStr = "SELECT * from pdd_user_info where id = '" + results.insertId + "'LIMIT 1"
                        conn.query(sqlStr, (error, results, fields) => {
                            if (error) {
                                res.json({err_code: 0, message: '请求数据失败'})
                            } else {
                                results = JSON.parse(JSON.stringify(results))
                                // 返回数据给客户端
                                res.json({
                                    success_code: 200,
                                    message: results[0]
                                })
                            }
                        })
                    }
                })
            }
        }
        console.log(req.session)
    })
})

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: '撩课学院'});
});

/*
* 一次性图形验证码
* */
router.get('/api/captcha', (req, res) => {
    //1生成随机验证码
    let captcha = svgCaptcha.create({
        color: false,
        noise: 0,
        ignoreChars: 'oilOIL0',
        size: 4
    })
    // 2.保存
    req.session.captcha = captcha.text.toLowerCase()
    // 3. 返回客户端
    res.type('svg');
    res.send(captcha.data)
})
/**
 * 发送验证码短信
 * */
router.get('/api/send_code', (req, res) => {
    //1.获取手机号码
    let phone = req.query.phone
    // 2.验证码
    let code = sms_util.randomCode(6)
    /* sms_util.sendCode(phone, code, function (success) {
         if (success) {
             users[phone] = code
             res.json({success_code: 200, message: '验证码获取成功'})
         } else {
             res.json({err_code: 0, message: '验证码获取失败'})
         }
     })*/

    setTimeout(() => {
        // 成功
        users[phone] = code
        res.json({success_code: 200, message: code})
        // res.json({err_code: 0, message: '验证码获取失败'})
    }, 100)
    // 失败
    // res.json({err_code: 0, message: '验证码获取失败'})
})

// const recommendArr = require('./../data/recommend').data;
// router.get('/api/recommend', function (req, res, next) {
//     // 1.定义临时数组
//     let temp_arr_all = [];
//     // 2. 遍历
//     for (let i = 0; i < recommendArr.length; i++) {
//         // 2.1取出单个数据对象
//         let oldItem = recommendArr[i]
//         // 2.2取出数据表中对应的字段
//         let temp_arr = []
//         temp_arr.push(oldItem.goods_id)
//         temp_arr.push(oldItem.goods_name)
//         temp_arr.push(oldItem.short_name)
//         temp_arr.push(oldItem.thumb_url)
//         temp_arr.push(oldItem.hd_thumb_url)
//         temp_arr.push(oldItem.image_url)
//         temp_arr.push(oldItem.price)
//         temp_arr.push(oldItem.normal_price)
//         temp_arr.push(oldItem.market_price)
//         temp_arr.push(oldItem.sales_tip)
//         temp_arr.push(oldItem.hd_url)
//         //2.3合并到大的数组
//         temp_arr_all.push(temp_arr)
//     }
//     // 3. 批量插入数据库表
//     // 3.1 数据库查询语句
//     let sqlStr = "INSERT INTO pdd_recommend (`goods_id`,`goods_name`,`short_name`, `thumb_url`, `hd_thumb_url`, `image_url`, `price`, `normal_price`, `market_price`, `sales_tip`,`hd_url`) VALUES ?";
//     //3.2执行语句
//     conn.query(sqlStr, [temp_arr_all], (error, results, fields) => {
//         if (error) {
//             console.log('INSERT ERROR - ', error.message);
//             return;
//         }
//         console.log("INSERT SUCCESS");
//     })
// })

module.exports = router;

/** 获取首页轮播图*/
router.get('/api/homecasual', (req, res) => {
    const data = require('../data/homecasual');
    res.json({ success_code: 200, message: data })
});


/**
 * 获取首页导航
 */
router.get('/api/homenav', (req, res) => {
    /*
    let sqlStr = 'select * from homenav';
     conn.query(sqlStr, (err, results) => {
         if (err) return res.json({err_code: 1, message: '资料不存在', affextedRows: 0})
         res.json({success_code: 200, message: results, affextedRows: results.affextedRows})
     })
     */
    const data = require('../data/homenav');
    res.json({success_code: 200, message: data});
});

/**
 * 获取首页商品列表
 */
router.get('/api/homeshoplist', (req, res) => {
    /*
   let sqlStr = 'select * from homeshoplist';
    conn.query(sqlStr, (err, results) => {
        if (err) return res.json({err_code: 1, message: '资料不存在', affextedRows: 0})
        res.json({success_code: 200, message: results, affextedRows: results.affextedRows})
    })
    */
    setTimeout(function () {
        const data = require('../data/shopList');
        res.json({success_code: 200, message: data})
    }, 300);
});

/**
 * 获取推荐商品列表
 * 1,20
 */
router.get('/api/recommendshoplist', (req, res) => {
    // 1.0 获取参数
    let pageNo = req.query.page || 1;
    let pageSize = req.query.count || 20;
    console.log(pageNo)
    console.log(pageSize)
    //1.1 数据库查询语句
    let sqlStr = 'SELECT * from pdd_recommend LIMIT ' + (pageNo - 1) * pageSize + ',' + pageSize;
    // 1.2 执行语句
    conn.query(sqlStr, (error, results, fields) => {
        if (error) {
            res.json({err_code: 0, message: '请求数据失败'})
        } else {
            setTimeout(() => {
                res.json({success_code: 200, message: results})
            }, 100)
        }
    })

});

/**
 * 获取推荐商品列表拼单用户
 */
router.get('/api/recommenduser', (req, res) => {
    setTimeout(function () {
        const data = require('../data/recommend_users');
        res.json({success_code: 200, message: data})
    }, 10);
});

/**
 * 获取搜索分类列表
 */
router.get('/api/searchgoods', (req, res) => {
    setTimeout(function () {
        const data = require('../data/search');
        res.json({success_code: 200, message: data})
    }, 10);
});

/**
 * 获取商品数据
 */
router.get('/api/getqalist', (req, res) => {
    const course = req.query.course;
    const limit = req.query.limit || 20;
    const keyword = req.query.keyword || '';

    let sqlStr = 'select * from qa where course= "' + course + '" LIMIT ' + limit;
    if (keyword !== '') {
        sqlStr = 'select * from qa where course= "' + course + '" AND qname LIKE "%' + keyword + '%" LIMIT ' + limit;
    }

    conn.query(sqlStr, (err, results) => {
        if (err) return res.json({err_code: 1, message: '资料不存在', affextedRows: 0});
        res.json({success_code: 200, message: results, affextedRows: results.affextedRows})
    })
});
