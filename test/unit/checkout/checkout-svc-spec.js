/**
 * [y] hybris Platform
 *
 * Copyright (c) 2000-2014 hybris AG
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of hybris
 * ("Confidential Information"). You shall not disclose such Confidential
 * Information and shall use it only in accordance with the terms of the
 * license agreement you entered into with hybris.
 */
describe('CheckoutSvc', function () {

    var checkoutUrl = 'http://checkout';
    var checkoutRoute = '/checkouts/order';
    var fullCheckoutPath = checkoutUrl+checkoutRoute;
    var checkoutOrderUrl = 'http://checkout-mashup-v1.test.cf.hybris.com/checkouts/order';

    var $scope, $rootScope, $httpBackend, $q, mockedCartSvc, mockedStripeJS, checkoutSvc;

    var order = {};

    order.billTo = {
        firstName: 'Bob',
        lastName: 'Smith',
        address1: 'Bill Str. 14',
        city:    'Amarillo',
        state:  'TX',
        zip: '79109',
        country: 'USA',
        email: 'bs@sushi.com'
    };

    order.shipTo = {
        firstName: 'Amy',
        lastName: 'Willis',
        address1: 'Ship Lane 56',
        city: 'Arvada',
        state: 'CO',
        country: 'USA',
        zip: '80005'
    };

    order.creditCard = {};
    order.shippingCost = 4.5;

    var cart =  {};
    cart.id = 'abcCart';
    cart.subtotal = 2.99;
    cart.estTax = 0.3;
    var totalPrice = {};
    totalPrice.price = 7.79;
    cart.totalPrice = totalPrice;
    order.cart = cart;


    var checkoutJson =  {"cartId":"abcCart","currency":"USD","orderTotal":7.79,
        "addresses":[
            {"contactName":"Bob Smith","street":"Bill Str. 14","city":"Amarillo","state":"TX","zipCode":"79109",
                "country":"USA","account":"bs@sushi.com","type":"BILLING"},
            {"contactName":"Amy Willis","street":"Ship Lane 56","city":"Arvada","state":"CO","zipCode":"80005",
                "country":"USA","type":"SHIPPING"}],
        "customer":{"name":"Bob Smith","email":"bs@sushi.com"}}

    mockedStripeJS = {};
    mockedCartSvc = {};

    beforeEach(function(){
        mockedCartSvc.resetCart = jasmine.createSpy('resetCart');

        this.addMatchers({
            toEqualData: function (expected) {
                return angular.equals(this.actual, expected);
            }
        });
    });

    describe('checkout with successful payment', function(){
        var stripeResponse = {};
        var stripeStatus = {};

        beforeEach(function() {
            module('restangular');
            module('ds.checkout');
        });

        beforeEach(module('ds.checkout', function($provide) {

            mockedStripeJS.createToken = function(data, callback) {
                callback(stripeStatus, stripeResponse);
            };
            $provide.value('CartSvc', mockedCartSvc);
            $provide.value('StripeJS', mockedStripeJS);
        }));

        beforeEach(function () {

            inject(function (_$httpBackend_, _$rootScope_, _CheckoutSvc_, _$q_) {
                $rootScope = _$rootScope_;
                $scope = _$rootScope_.$new();
                $httpBackend = _$httpBackend_;
                checkoutSvc = _CheckoutSvc_;
                $q = _$q_;
            });

            $httpBackend.whenGET(/^[A-Za-z-/]*\.html/).respond({});
        });

        describe('getDefaultOrder', function(){
            it('should create order with credit card', function(){
                var order = checkoutSvc.getDefaultOrder();
                expect(order.shipTo).toBeTruthy();
                expect(order.billTo).toBeTruthy();
                expect(order.billTo.country).toEqualData('USA');
                expect(order.paymentMethod).toEqualData('creditCard');
                expect(order.creditCard).toBeTruthy();
            });
        });

        describe('and successful order placement', function () {

            beforeEach(function(){
                // $httpBackend.expectPOST(fullCheckoutPath, checkoutJson).respond({"orderId":"456"});
                $httpBackend.expectPOST(checkoutOrderUrl, checkoutJson).respond({"orderId":"456"});
            });

            it('should issue POST', function () {
                checkoutSvc.checkout(order);
                $httpBackend.flush();
            });

            it('should remove products from the cart after placing order', function () {
                checkoutSvc.checkout(order);
                $httpBackend.flush();
                $rootScope.$digest();
                expect(mockedCartSvc.resetCart).toHaveBeenCalled();
            });

        })

        describe('and order placement failing due to HTTP 500', function(){
            beforeEach(function(){
                $httpBackend.expectPOST(checkoutOrderUrl, checkoutJson).respond(500, '');
            });

            it('should display System Unavailable', function(){
                var
                    onSuccessSpy = jasmine.createSpy('success'),
                    onErrorSpy = jasmine.createSpy('error'),
                    error500msg = 'Cannot process this order because the system is unavailable. Try again at a later time.';

                checkoutSvc.checkout(order).then(onSuccessSpy, onErrorSpy);
                $httpBackend.flush();
                $rootScope.$digest();

                expect(onSuccessSpy).not.toHaveBeenCalled();
                expect(onErrorSpy).toHaveBeenCalledWith({ type: checkoutSvc.ERROR_TYPES.order, error: error500msg });
            });
        });

        describe('and order placement due to other error', function(){
            beforeEach(function(){
                $httpBackend.expectPOST(checkoutOrderUrl, checkoutJson).respond(400, '');
            });

            it('should display System Unavailable', function(){
                var
                    onSuccessSpy = jasmine.createSpy('success'),
                    onErrorSpy = jasmine.createSpy('error'),
                    error400msg = 'Order could not be processed. Status code: 400.';

                checkoutSvc.checkout(order).then(onSuccessSpy, onErrorSpy);
                $httpBackend.flush();
                $rootScope.$digest();

                expect(onSuccessSpy).not.toHaveBeenCalled();
                expect(onErrorSpy).toHaveBeenCalledWith({ type: checkoutSvc.ERROR_TYPES.order, error: error400msg });
            });
        });

    });

    describe('failing Stripe token gen', function(){
        var stripeStatus = {};
        var stripeResponse = {};
        var errorMessage = 'Failure';
        stripeResponse.error = {};
        stripeResponse.error.message = errorMessage;

        beforeEach(function() {
            module('restangular');
        });

        beforeEach(module('ds.checkout', function($provide) {
            var createTokenStub = function(data, callback) {
                callback(stripeStatus, stripeResponse);
            };
            mockedStripeJS.createToken = createTokenStub;

            $provide.value('CartSvc', mockedCartSvc);
            $provide.value('StripeJS', mockedStripeJS);
        }));

        beforeEach(function () {
            inject(function (_$httpBackend_, _$rootScope_, _CheckoutSvc_) {
                $rootScope = _$rootScope_;
                $scope = _$rootScope_.$new();
                $httpBackend = _$httpBackend_;
                checkoutSvc = _CheckoutSvc_;
            });

            $httpBackend.whenGET(/^[A-Za-z-/]*\.html/).respond({});
        });


        it('should not place order', function(){
             checkoutSvc.checkout(order);
             $httpBackend.verifyNoOutstandingRequest();
        });

        it('should invoke error handler', function(){
            var onSuccessSpy = jasmine.createSpy('success'),
                onErrorSpy = jasmine.createSpy('error');

            checkoutSvc.checkout(order).then(onSuccessSpy, onErrorSpy);
            $rootScope.$digest();

            expect(onSuccessSpy).not.toHaveBeenCalled();
            expect(onErrorSpy).toHaveBeenCalledWith({ type: checkoutSvc.ERROR_TYPES.stripe, error: stripeResponse.error });
        });

    });

});
