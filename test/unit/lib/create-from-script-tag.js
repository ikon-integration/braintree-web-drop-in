jest.mock('../../../src/lib/analytics');

const createFromScriptTag = require('../../../src/lib/create-from-script-tag');
const findParentForm = require('../../../src/lib/find-parent-form');
const analytics = require('../../../src/lib/analytics');
const { yields } = require('../../helpers/yields');

describe('createFromScriptTag', () => {
  let testContext;

  beforeEach(() => {
    const container = document.createElement('div');

    testContext = {};

    container.id = 'script-container';
    testContext.instance = {
      requestPaymentMethod: jest.fn().mockImplementation(yields(null, { nonce: 'a-nonce' }))
    };
    testContext.scriptTag = document.createElement('script');
    testContext.scriptTag.dataset.braintreeDropinAuthorization = 'an-authorization';
    testContext.createFunction = jest.fn().mockResolvedValue(testContext.instance);
    testContext.fakeForm = {
      addEventListener: jest.fn(),
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      submit: jest.fn()
    };
    jest.spyOn(findParentForm, 'findParentForm').mockReturnValue(testContext.fakeForm);

    container.appendChild(testContext.scriptTag);
    jest.spyOn(testContext.scriptTag.parentNode, 'insertBefore').mockImplementation();
  });

  it('returns early if no script tag is provided', () => {
    jest.spyOn(document, 'createElement');

    createFromScriptTag(testContext.createFunction);

    expect(document.createElement).not.toBeCalled();
  });

  it('throws an error if script tag does not include an authorization', () => {
    delete testContext.scriptTag.dataset.braintreeDropinAuthorization;
    jest.spyOn(document, 'createElement');

    expect(() => {
      createFromScriptTag(testContext.createFunction, testContext.scriptTag);
    }).toThrowError('Authorization not found in data-braintree-dropin-authorization attribute');

    expect(document.createElement).not.toBeCalled();
  });

  it('creates a container for Drop-in', () => {
    jest.spyOn(document, 'createElement');

    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    expect(document.createElement).toBeCalledTimes(1);
    expect(document.createElement).toBeCalledWith('div');
  });

  it('throws an error if no form can be found', () => {
    findParentForm.findParentForm.mockReturnValue(null);

    expect(() => {
      createFromScriptTag(testContext.createFunction, testContext.scriptTag);
    }).toThrowError('No form found for script tag integration.');
  });

  it('inserts container before script tag when form is found', done => {
    const fakeContainer = {};

    jest.spyOn(document, 'createElement').mockReturnValue(fakeContainer);
    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      expect(testContext.scriptTag.parentNode.insertBefore).toBeCalledTimes(1);
      expect(testContext.scriptTag.parentNode.insertBefore).toBeCalledWith(fakeContainer, testContext.scriptTag);
      done();
    });
  });

  it('calls create with authorization and container', done => {
    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      expect(testContext.createFunction).toBeCalledTimes(1);
      expect(testContext.createFunction).toBeCalledWith(expect.objectContaining({
        authorization: 'an-authorization',
        container: expect.anything()
      }));
      done();
    });
  });

  it('sends an analytics event for script tag integration', done => {
    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      expect(analytics.sendEvent).toBeCalledTimes(1);
      expect(analytics.sendEvent).toBeCalledWith('integration-type.script-tag');
      done();
    });
  });

  it('adds submit listener to form for requesting a payment method', done => {
    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      expect(testContext.fakeForm.addEventListener).toBeCalledTimes(2);
      expect(testContext.fakeForm.addEventListener).toBeCalledWith('submit', expect.any(Function));
      done();
    });
  });

  it('prevents default form submission', done => {
    let submitHandler;
    const fakeEvent = {
      preventDefault: jest.fn()
    };

    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[0][1];
      submitHandler(fakeEvent);

      expect(fakeEvent.preventDefault).toBeCalledTimes(1);
      done();
    });
  });

  it('calls requestPaymentMethod when form submits', done => {
    let submitHandler;

    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
      submitHandler();

      expect(testContext.instance.requestPaymentMethod).toBeCalledTimes(1);
      done();
    });
  });

  it('prevents default form submission before Drop-in is created', done => {
    let submitHandler;
    const fakeEvent = { preventDefault: jest.fn() };

    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[0][1];
      submitHandler(fakeEvent);

      expect(fakeEvent.preventDefault).toBeCalledTimes(1);
      done();
    });
  });

  it('calls requestPaymentMethod when form submits', done => {
    let submitHandler;

    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
      submitHandler();

      expect(testContext.instance.requestPaymentMethod).toBeCalledTimes(1);
      done();
    });
  });

  it('adds payment method nonce to form and submits form if payment method is requestable', done => {
    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      const submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];

      submitHandler();

      const input = testContext.fakeForm.appendChild.mock.calls[0][0];

      expect(testContext.fakeForm.appendChild).toBeCalledTimes(1);
      expect(testContext.fakeForm.appendChild).toBeCalledWith(input);
      expect(input.type).toBe('hidden');
      expect(input.name).toBe('payment_method_nonce');
      expect(input.value).toBe('a-nonce');
      expect(testContext.fakeForm.submit).toBeCalledTimes(1);
      done();
    });
  });

  it('does not add nonce and submit form if requestPaymentMethod fails', done => {
    let submitHandler;

    testContext.instance.requestPaymentMethod.mockImplementation(yields(new Error('failure')));
    jest.spyOn(document, 'createElement');
    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
      submitHandler();

      expect(document.createElement).not.toBeCalledWith('input');
      expect(testContext.fakeForm.submit).not.toBeCalled();
      done();
    });
  });

  it('uses existing payment_method_nonce input if it already exists', done => {
    let submitHandler;
    const fakeInput = {};

    testContext.fakeForm.querySelector.mockReturnValue(fakeInput);
    jest.spyOn(document, 'createElement');

    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
      submitHandler();

      expect(testContext.fakeForm.appendChild).not.toBeCalled();
      expect(document.createElement).not.toBeCalledWith('input');
      expect(fakeInput.value).toBe('a-nonce');
      expect(testContext.fakeForm.submit).toBeCalledTimes(1);
      done();
    });
  });

  it('adds device data to form and submits form if request payment method contains device data', done => {
    let submitHandler;

    testContext.instance.requestPaymentMethod.mockImplementation(yields(null, {
      nonce: 'a-nonce',
      deviceData: 'some-data'
    }));
    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
      submitHandler();

      const deviceDataInput = testContext.fakeForm.appendChild.mock.calls[1][0];

      expect(testContext.fakeForm.appendChild).toBeCalledTimes(2);
      expect(deviceDataInput.type).toBe('hidden');
      expect(deviceDataInput.name).toBe('device_data');
      expect(deviceDataInput.value).toBe('some-data');
      expect(testContext.fakeForm.submit).toBeCalledTimes(1);
      done();
    });
  });

  it('uses existing device_data input if it already exists', done => {
    let submitHandler;
    const fakeInput = {};

    testContext.fakeForm.querySelector.mockImplementation(selector => { // eslint-disable-line consistent-return
      if (selector === '[name="payment_method_nonce"]') {
        return {};
      } else if (selector === '[name="device_data"]') {
        return fakeInput;
      }
    });
    jest.spyOn(document, 'createElement');
    testContext.instance.requestPaymentMethod.mockImplementation(yields(null, {
      nonce: 'a-nonce',
      deviceData: 'some-data'
    }));

    createFromScriptTag(testContext.createFunction, testContext.scriptTag);

    setTimeout(() => {
      submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
      submitHandler();

      expect(testContext.fakeForm.appendChild).not.toBeCalled();
      expect(document.createElement).not.toBeCalledWith('input');
      expect(fakeInput.value).toBe('some-data');
      expect(testContext.fakeForm.submit).toBeCalledTimes(1);
      done();
    });
  });

  describe('data attributes handling', () => {
    it('accepts strings', done => {
      let submitHandler;

      testContext.scriptTag.dataset.locale = 'es_ES';

      createFromScriptTag(testContext.createFunction, testContext.scriptTag);

      setTimeout(() => {
        submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
        submitHandler();

        expect(testContext.createFunction).toBeCalledTimes(1);
        expect(testContext.createFunction).toBeCalledWith(expect.objectContaining({
          locale: 'es_ES'
        }));
        done();
      });
    });

    it('accepts Booleans', done => {
      let submitHandler;

      // no properties available are booleans
      // but there may be ones in the future
      // so we just use locale for testing right now
      testContext.scriptTag.dataset.locale = 'true';

      createFromScriptTag(testContext.createFunction, testContext.scriptTag);

      setTimeout(() => {
        submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
        submitHandler();

        expect(testContext.createFunction).toBeCalledTimes(1);
        expect(testContext.createFunction).toBeCalledWith(expect.objectContaining({
          locale: true
        }));
        done();
      });
    });

    it('accepts arrays', done => {
      let submitHandler;

      testContext.scriptTag.dataset.paymentOptionPriority = '["paypal", "card"]';

      createFromScriptTag(testContext.createFunction, testContext.scriptTag);

      setTimeout(() => {
        submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
        submitHandler();

        expect(testContext.createFunction).toBeCalledTimes(1);
        expect(testContext.createFunction).toBeCalledWith(expect.objectContaining({
          paymentOptionPriority: ['paypal', 'card']
        }));
        done();
      });
    });

    it('accepts objects', done => {
      let submitHandler;

      testContext.scriptTag.dataset['paypal.flow'] = 'checkout';
      testContext.scriptTag.dataset['paypal.amount'] = '10.00';
      testContext.scriptTag.dataset['paypal.currency'] = 'USD';
      testContext.scriptTag.dataset['paypalCredit.flow'] = 'vault';

      createFromScriptTag(testContext.createFunction, testContext.scriptTag);

      setTimeout(() => {
        submitHandler = testContext.fakeForm.addEventListener.mock.calls[1][1];
        submitHandler();

        expect(testContext.createFunction).toBeCalledTimes(1);
        expect(testContext.createFunction).toBeCalledWith(expect.objectContaining({
          paypal: {
            flow: 'checkout',
            amount: 10,
            currency: 'USD'
          },
          paypalCredit: {
            flow: 'vault'
          }
        }));
        done();
      });
    });
  });
});